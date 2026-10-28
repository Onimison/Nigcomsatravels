-- ERP integration foundation.
--
-- This migration deliberately stores a frozen costing-memo export separately
-- from the mutable travel request. Business Central can retry a GET or an
-- acknowledgement without changing the financial evidence that HR approved.

ALTER TABLE travel_requests
  ADD COLUMN IF NOT EXISTS approval_source TEXT NOT NULL DEFAULT 'local'
    CHECK (approval_source IN ('local', 'erp')),
  ADD COLUMN IF NOT EXISTS hr_author_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS costing_memo_body TEXT,
  ADD COLUMN IF NOT EXISTS costing_memo_template_version TEXT;

COMMENT ON COLUMN travel_requests.approval_source IS
  'Authority for final approval. ERP-routed requests cannot be decided by the local MD action.';
COMMENT ON COLUMN travel_requests.hr_author_snapshot IS
  'Server-derived HR name, organizational title, office email, and timestamp frozen at HR submission.';
COMMENT ON COLUMN travel_requests.costing_memo_body IS
  'Rendered HR costing memo body. Structured financial fields remain authoritative.';
COMMENT ON COLUMN travel_requests.costing_memo_template_version IS
  'Internal rendering-contract identifier; it is not automatically printed in the memo body.';

CREATE TABLE IF NOT EXISTS erp_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE RESTRICT,
  source_memo_number TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  schema_version TEXT NOT NULL DEFAULT '1.0',
  payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'acknowledged', 'error', 'held')),
  last_error_code TEXT,
  last_error_message TEXT,
  available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (request_id, revision),
  UNIQUE (source_memo_number, revision)
);

CREATE INDEX IF NOT EXISTS idx_erp_exports_pending
  ON erp_exports (available_at, id)
  WHERE state IN ('pending', 'error');

CREATE TABLE IF NOT EXISTS erp_delivery_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_id UUID NOT NULL UNIQUE REFERENCES erp_exports(id) ON DELETE RESTRICT,
  erp_company_id TEXT NOT NULL,
  erp_costing_memo_number TEXT NOT NULL,
  erp_workflow_reference TEXT NOT NULL,
  received_payload_sha256 TEXT NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (erp_company_id, erp_costing_memo_number),
  UNIQUE (erp_company_id, erp_workflow_reference)
);

ALTER TABLE erp_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_delivery_receipts ENABLE ROW LEVEL SECURITY;

-- No browser role receives direct access. Server-side integration functions
-- use the service role or narrowly granted database functions after the API
-- has authenticated the Business Central integration.
CREATE POLICY "No direct client access to ERP exports" ON erp_exports
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "No direct client access to ERP receipts" ON erp_delivery_receipts
  FOR ALL USING (false) WITH CHECK (false);

-- ERP-owned requests are approved in Business Central. Keep them out of the
-- local MD queue and prevent a direct PostgREST update from deciding them.
DROP POLICY IF EXISTS "MD read pending/approved/rejected" ON travel_requests;
CREATE POLICY "MD read local pending/approved/rejected" ON travel_requests
  FOR SELECT USING (
    current_staff_role() = 'md'
    AND approval_source = 'local'
    AND status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final')
  );

DROP POLICY IF EXISTS "MD update status when pending_md" ON travel_requests;
CREATE POLICY "MD update local status when pending_md" ON travel_requests
  FOR UPDATE USING (
    current_staff_role() = 'md'
    AND approval_source = 'local'
    AND status = 'pending_md'
  ) WITH CHECK (
    approval_source = 'local'
    AND status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final')
  );

-- Phase 0 financial and workflow writes must go through the atomic HR RPC.
-- Legacy rows (without a memo number) retain the existing compatibility path.
CREATE OR REPLACE FUNCTION prevent_direct_phase0_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.memo_number IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 0 requests can only be changed by the HR review transaction' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_direct_phase0_request_update ON travel_requests;
CREATE TRIGGER prevent_direct_phase0_request_update
  BEFORE UPDATE ON travel_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_phase0_request_update();

CREATE OR REPLACE FUNCTION prevent_direct_phase0_traveler_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM travel_requests
       WHERE travel_requests.id = OLD.request_id
         AND travel_requests.memo_number IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Phase 0 travellers can only be changed by the HR review transaction' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_direct_phase0_traveler_update ON request_travelers;
CREATE TRIGGER prevent_direct_phase0_traveler_update
  BEFORE UPDATE ON request_travelers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_phase0_traveler_update();
