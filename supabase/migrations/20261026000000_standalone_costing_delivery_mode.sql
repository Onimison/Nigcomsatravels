-- Separate HR costing finalization from Business Central delivery.
-- Manual artifacts are held for download/copy and are never returned by the
-- Business Central collection endpoints until explicitly enrolled.

ALTER TABLE erp_exports
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'business_central_api'
    CHECK (delivery_mode IN ('manual', 'business_central_api'));

CREATE INDEX IF NOT EXISTS idx_erp_exports_business_central_pending
  ON erp_exports (available_at, id)
  WHERE delivery_mode = 'business_central_api'
    AND state IN ('pending', 'error');

CREATE OR REPLACE FUNCTION finalize_hr_costing_standalone_v1(
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
  result_row JSONB;
  export_id UUID;
BEGIN
  -- Reuse the already-reviewed atomic transaction. This nested call and the
  -- delivery-mode update commit or roll back together.
  result_row := finalize_hr_review_v2(
    p_request_id,
    p_hr_staff_id,
    p_days,
    p_total_ngn,
    p_traveler_updates,
    p_override_rows,
    p_hr_note,
    p_hr_author_snapshot,
    p_costing_memo_body,
    p_template_version,
    p_export_payload
  );

  export_id := (result_row->>'erp_export_id')::UUID;

  UPDATE erp_exports
  SET delivery_mode = 'manual',
      state = 'held',
      updated_at = now()
  WHERE id = export_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Standalone costing export was not created' USING ERRCODE = 'P0002';
  END IF;

  RETURN result_row || jsonb_build_object(
    'delivery_mode', 'manual',
    'status', 'held'
  );
END;
$$;

REVOKE ALL ON FUNCTION finalize_hr_costing_standalone_v1(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_hr_costing_standalone_v1(UUID, UUID, INTEGER, NUMERIC, JSONB, JSONB, TEXT, JSONB, TEXT, TEXT, JSONB) TO service_role;
