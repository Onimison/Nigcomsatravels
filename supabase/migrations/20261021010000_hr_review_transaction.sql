-- Atomic HR v2 review finalization.
--
-- Pricing remains in the shared TypeScript calculator. This function owns
-- the transaction boundary: either every reviewed traveler, the request
-- state, the HR audit row, and override audit rows commit, or none do.

ALTER TABLE rate_overrides
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE OR REPLACE FUNCTION finalize_hr_review_v2(
  p_request_id UUID,
  p_hr_staff_id UUID,
  p_days INTEGER,
  p_total_ngn NUMERIC,
  p_traveler_updates JSONB,
  p_override_rows JSONB,
  p_hr_note TEXT
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_hr_staff_id THEN
    RAISE EXCEPTION 'HR actor does not match the authenticated user' USING ERRCODE = '42501';
  END IF;

  IF current_staff_role() NOT IN ('hr', 'admin') THEN
    RAISE EXCEPTION 'Only HR can finalize a v2 review' USING ERRCODE = '42501';
  END IF;

  IF p_days < 1 THEN
    RAISE EXCEPTION 'Review days must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request_row
  FROM travel_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Travel request was not found' USING ERRCODE = 'P0002';
  END IF;

  IF request_row.status <> 'pending_hr' THEN
    RAISE EXCEPTION 'Travel request is no longer awaiting HR review' USING ERRCODE = '40001';
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

  UPDATE travel_requests
  SET days = p_days,
      total_ngn = p_total_ngn,
      status = 'pending_md',
      approval_source = 'erp',
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

  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'pending_md');
END;
$$;

REVOKE ALL ON FUNCTION finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_hr_review_v2(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT) TO authenticated;
