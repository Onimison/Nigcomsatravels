-- Business Central identity mapping and atomic ERP export creation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS erp_employee_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_erp_employee_number
  ON staff (erp_employee_number)
  WHERE erp_employee_number IS NOT NULL;

ALTER TABLE travel_requests
  ADD COLUMN IF NOT EXISTS erp_export_id UUID REFERENCES erp_exports(id) ON DELETE RESTRICT;

DROP FUNCTION IF EXISTS finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION finalize_hr_review_v2(
  p_request_id UUID,
  p_hr_staff_id UUID,
  p_days INTEGER,
  p_total_ngn NUMERIC,
  p_traveler_updates JSONB,
  p_override_rows JSONB,
  p_hr_note TEXT,
  p_hr_author_snapshot JSONB,
  p_costing_memo_body TEXT,
  p_template_version TEXT,
  p_export_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_row travel_requests%ROWTYPE;
  expected_traveler_count INTEGER;
  supplied_traveler_count INTEGER;
  distinct_traveler_count INTEGER;
  updated_traveler_count INTEGER;
  supplied_total NUMERIC;
  export_id UUID;
  latest_revision INTEGER;
  export_revision INTEGER;
  payload_to_store JSONB;
  payload_sha256 TEXT;
  actor_role TEXT;
BEGIN
  SELECT role INTO actor_role
  FROM staff
  WHERE id = p_hr_staff_id
    AND active = true;

  IF actor_role IS NULL OR actor_role NOT IN ('hr', 'admin') THEN
    RAISE EXCEPTION 'Only HR can finalize a v2 review' USING ERRCODE = '42501';
  END IF;

  IF p_days < 1
     OR p_costing_memo_body IS NULL
     OR length(trim(p_costing_memo_body)) = 0
     OR p_hr_author_snapshot IS NULL
     OR p_template_version IS NULL
     OR length(trim(p_template_version)) = 0 THEN
    RAISE EXCEPTION 'Review data is incomplete' USING ERRCODE = '22023';
  END IF;

  IF p_export_payload IS NULL OR p_export_payload->>'export_id' IS NULL THEN
    RAISE EXCEPTION 'ERP export identity is missing' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request_row
  FROM travel_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Travel request was not found' USING ERRCODE = 'P0002';
  END IF;

  IF request_row.status <> 'pending_hr' THEN
    IF request_row.status = 'pending_md'
       AND request_row.approval_source = 'erp'
       AND request_row.erp_export_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'request_id', p_request_id,
        'erp_export_id', request_row.erp_export_id,
        'status', request_row.status,
        'idempotent_replay', true
      );
    END IF;

    RAISE EXCEPTION 'Travel request is no longer awaiting HR review' USING ERRCODE = '40001';
  END IF;

  IF request_row.memo_number IS NULL THEN
    RAISE EXCEPTION 'Travel request has no source memo number' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO expected_traveler_count
  FROM request_travelers
  WHERE request_id = p_request_id;

  SELECT count(*) INTO supplied_traveler_count
  FROM jsonb_to_recordset(p_traveler_updates) AS update_row(id UUID);

  SELECT count(DISTINCT update_row.id) INTO distinct_traveler_count
  FROM jsonb_to_recordset(p_traveler_updates) AS update_row(id UUID);

  IF expected_traveler_count = 0
     OR supplied_traveler_count <> expected_traveler_count
     OR distinct_traveler_count <> expected_traveler_count THEN
    RAISE EXCEPTION 'Traveler update set does not match the request' USING ERRCODE = '22023';
  END IF;

  SELECT sum(update_row.traveller_total) INTO supplied_total
  FROM jsonb_to_recordset(p_traveler_updates) AS update_row(traveller_total NUMERIC);

  IF supplied_total IS NULL OR supplied_total <> p_total_ngn THEN
    RAISE EXCEPTION 'Traveler totals do not match the request total' USING ERRCODE = '22023';
  END IF;

  UPDATE request_travelers AS traveler
  SET designation_name = update_row.designation_name,
      grade_band_code = update_row.grade_band_code,
      is_unmapped = false,
      dta_rate_used = update_row.dta_rate_used,
      local_running_rate_used = update_row.local_running_rate_used,
      dta_amount = update_row.dta_amount,
      local_running_amount = update_row.local_running_amount,
      transport_override = update_row.transport_override,
      airport_taxi_override = update_row.airport_taxi_override,
      traveller_total = update_row.traveller_total
  FROM jsonb_to_recordset(p_traveler_updates) AS update_row(
    id UUID,
    designation_name TEXT,
    grade_band_code TEXT,
    dta_rate_used NUMERIC,
    local_running_rate_used NUMERIC,
    dta_amount NUMERIC,
    local_running_amount NUMERIC,
    transport_override NUMERIC,
    airport_taxi_override NUMERIC,
    traveller_total NUMERIC
  )
  WHERE traveler.id = update_row.id
    AND traveler.request_id = p_request_id;

  GET DIAGNOSTICS updated_traveler_count = ROW_COUNT;
  IF updated_traveler_count <> expected_traveler_count THEN
    RAISE EXCEPTION 'One or more travelers do not belong to the request' USING ERRCODE = '22023';
  END IF;

  SELECT revision INTO latest_revision
  FROM erp_exports
  WHERE source_memo_number = request_row.memo_number
  ORDER BY revision DESC
  LIMIT 1
  FOR UPDATE;

  export_revision := COALESCE(latest_revision, 0) + 1;
  payload_to_store := jsonb_set(
    p_export_payload,
    '{costing_memo_revision}',
    to_jsonb(export_revision),
    true
  );

  IF (payload_to_store->>'source_memo_number') <> request_row.memo_number
     OR (payload_to_store->>'currency') <> 'NGN'
     OR (payload_to_store->>'costing_memo_body') <> p_costing_memo_body
     OR (payload_to_store->>'costing_memo_template_version') <> p_template_version
     OR (payload_to_store->>'hr_author_email') <> (p_hr_author_snapshot->>'office_email')
     OR (payload_to_store->>'hr_author_title') <> (p_hr_author_snapshot->>'organizational_title')
     OR (payload_to_store->>'hr_author_name') <> (p_hr_author_snapshot->>'name')
     OR (payload_to_store->>'hr_authorized_at') <> (p_hr_author_snapshot->>'authorized_at')
     OR (payload_to_store->>'total_amount')::NUMERIC <> p_total_ngn THEN
    RAISE EXCEPTION 'ERP export payload does not match the reviewed request' USING ERRCODE = '22023';
  END IF;

  payload_sha256 := encode(digest(convert_to(payload_to_store::TEXT, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO erp_exports (
    id,
    request_id,
    source_memo_number,
    revision,
    schema_version,
    payload,
    payload_sha256,
    state
  )
  VALUES (
    (p_export_payload->>'export_id')::UUID,
    p_request_id,
    request_row.memo_number,
    export_revision,
    '1.0',
    payload_to_store,
    payload_sha256,
    'pending'
  )
  RETURNING id INTO export_id;

  UPDATE travel_requests
  SET days = p_days,
      total_ngn = p_total_ngn,
      status = 'pending_md',
      approval_source = 'erp',
      hr_author_snapshot = p_hr_author_snapshot,
      costing_memo_body = p_costing_memo_body,
      costing_memo_template_version = p_template_version,
      erp_export_id = export_id,
      updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO approvals (request_id, approver_id, status, reason, is_final)
  VALUES (p_request_id, p_hr_staff_id, 'hr_approved', p_hr_note, false);

  INSERT INTO rate_overrides (request_id, field_name, overridden_value, hr_staff_id, reason)
  SELECT p_request_id,
         override_row.field_name,
         override_row.overridden_value,
         p_hr_staff_id,
         override_row.reason
  FROM jsonb_to_recordset(p_override_rows) AS override_row(
    field_name TEXT,
    overridden_value NUMERIC,
    reason TEXT
  );

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'erp_export_id', export_id,
    'revision', export_revision,
    'status', 'pending_md'
  );
END;
$$;

REVOKE ALL ON FUNCTION finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION acknowledge_erp_export(
  p_export_id UUID,
  p_source_memo_number TEXT,
  p_erp_company_id TEXT,
  p_erp_costing_memo_number TEXT,
  p_erp_workflow_reference TEXT,
  p_received_payload_sha256 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  export_row erp_exports%ROWTYPE;
  receipt_row erp_delivery_receipts%ROWTYPE;
  conflicting_export UUID;
BEGIN
  SELECT * INTO export_row
  FROM erp_exports
  WHERE id = p_export_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ERP export was not found' USING ERRCODE = 'P0002';
  END IF;

  IF export_row.source_memo_number <> p_source_memo_number THEN
    RAISE EXCEPTION 'Source memo does not match the export' USING ERRCODE = 'P0009';
  END IF;

  IF export_row.payload_sha256 <> p_received_payload_sha256 THEN
    RAISE EXCEPTION 'ERP acknowledgement hash does not match the export' USING ERRCODE = 'P0009';
  END IF;

  SELECT * INTO receipt_row
  FROM erp_delivery_receipts
  WHERE export_id = p_export_id
  FOR UPDATE;

  IF FOUND THEN
    IF receipt_row.erp_company_id = p_erp_company_id
       AND receipt_row.erp_costing_memo_number = p_erp_costing_memo_number
       AND receipt_row.erp_workflow_reference = p_erp_workflow_reference
       AND receipt_row.received_payload_sha256 = p_received_payload_sha256 THEN
      RETURN jsonb_build_object(
        'export_id', p_export_id,
        'status', 'acknowledged',
        'erp_company_id', receipt_row.erp_company_id,
        'erp_costing_memo_number', receipt_row.erp_costing_memo_number,
        'erp_workflow_reference', receipt_row.erp_workflow_reference,
        'acknowledged_at', receipt_row.acknowledged_at
      );
    END IF;

    RAISE EXCEPTION 'ERP export already has a conflicting acknowledgement' USING ERRCODE = 'P0009';
  END IF;

  IF export_row.state = 'held' THEN
    RAISE EXCEPTION 'ERP export is held for reconciliation' USING ERRCODE = 'P0009';
  END IF;

  SELECT export_id INTO conflicting_export
  FROM erp_delivery_receipts
  WHERE erp_company_id = p_erp_company_id
    AND export_id <> p_export_id
    AND (erp_costing_memo_number = p_erp_costing_memo_number
      OR erp_workflow_reference = p_erp_workflow_reference)
  LIMIT 1;

  IF conflicting_export IS NOT NULL THEN
    RAISE EXCEPTION 'ERP memo or workflow reference is already bound to another export' USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO erp_delivery_receipts (
    export_id,
    erp_company_id,
    erp_costing_memo_number,
    erp_workflow_reference,
    received_payload_sha256
  )
  VALUES (
    p_export_id,
    p_erp_company_id,
    p_erp_costing_memo_number,
    p_erp_workflow_reference,
    p_received_payload_sha256
  )
  RETURNING * INTO receipt_row;

  UPDATE erp_exports
  SET state = 'acknowledged',
      acknowledged_at = receipt_row.acknowledged_at,
      updated_at = now()
  WHERE id = p_export_id;

  RETURN jsonb_build_object(
    'export_id', p_export_id,
    'status', 'acknowledged',
    'erp_company_id', receipt_row.erp_company_id,
    'erp_costing_memo_number', receipt_row.erp_costing_memo_number,
    'erp_workflow_reference', receipt_row.erp_workflow_reference,
    'acknowledged_at', receipt_row.acknowledged_at
  );
END;
$$;

REVOKE ALL ON FUNCTION acknowledge_erp_export(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acknowledge_erp_export(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
