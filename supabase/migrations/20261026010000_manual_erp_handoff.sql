-- Audited manual handoff for standalone costings entered in Business Central.

CREATE TABLE IF NOT EXISTS erp_manual_handoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  export_id UUID NOT NULL UNIQUE REFERENCES erp_exports(id) ON DELETE RESTRICT,
  erp_company_id TEXT NOT NULL CHECK (length(trim(erp_company_id)) > 0),
  erp_costing_memo_number TEXT NOT NULL CHECK (length(trim(erp_costing_memo_number)) > 0),
  erp_workflow_reference TEXT NOT NULL CHECK (length(trim(erp_workflow_reference)) > 0),
  recorded_by UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (erp_company_id, erp_costing_memo_number),
  UNIQUE (erp_company_id, erp_workflow_reference)
);

ALTER TABLE erp_manual_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct client access to manual ERP handoffs"
  ON erp_manual_handoffs
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION record_manual_erp_handoff(
  p_export_id UUID,
  p_staff_id UUID,
  p_erp_company_id TEXT,
  p_erp_costing_memo_number TEXT,
  p_erp_workflow_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  export_row erp_exports%ROWTYPE;
  handoff_row erp_manual_handoffs%ROWTYPE;
  actor_role TEXT;
BEGIN
  SELECT role INTO actor_role
  FROM staff
  WHERE id = p_staff_id AND active = true;

  IF actor_role IS NULL OR actor_role NOT IN ('hr', 'admin') THEN
    RAISE EXCEPTION 'Only HR or Admin can record a manual ERP handoff' USING ERRCODE = '42501';
  END IF;

  IF p_erp_company_id IS NULL OR length(trim(p_erp_company_id)) = 0
     OR p_erp_costing_memo_number IS NULL OR length(trim(p_erp_costing_memo_number)) = 0
     OR p_erp_workflow_reference IS NULL OR length(trim(p_erp_workflow_reference)) = 0 THEN
    RAISE EXCEPTION 'ERP handoff references are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO export_row
  FROM erp_exports
  WHERE id = p_export_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Costing export was not found' USING ERRCODE = 'P0002';
  END IF;

  IF export_row.delivery_mode <> 'manual' OR export_row.state <> 'held' THEN
    RAISE EXCEPTION 'Only held manual costings can receive a manual ERP handoff' USING ERRCODE = 'P0009';
  END IF;

  SELECT * INTO handoff_row
  FROM erp_manual_handoffs
  WHERE export_id = p_export_id
  FOR UPDATE;

  IF FOUND THEN
    IF handoff_row.erp_company_id = trim(p_erp_company_id)
       AND handoff_row.erp_costing_memo_number = trim(p_erp_costing_memo_number)
       AND handoff_row.erp_workflow_reference = trim(p_erp_workflow_reference) THEN
      RETURN jsonb_build_object(
        'export_id', p_export_id,
        'status', 'manual_entry_recorded',
        'idempotent_replay', true,
        'erp_company_id', handoff_row.erp_company_id,
        'erp_costing_memo_number', handoff_row.erp_costing_memo_number,
        'erp_workflow_reference', handoff_row.erp_workflow_reference,
        'recorded_at', handoff_row.recorded_at
      );
    END IF;
    RAISE EXCEPTION 'This costing already has a conflicting manual ERP handoff' USING ERRCODE = 'P0009';
  END IF;

  INSERT INTO erp_manual_handoffs (
    export_id,
    erp_company_id,
    erp_costing_memo_number,
    erp_workflow_reference,
    recorded_by
  )
  VALUES (
    p_export_id,
    trim(p_erp_company_id),
    trim(p_erp_costing_memo_number),
    trim(p_erp_workflow_reference),
    p_staff_id
  )
  RETURNING * INTO handoff_row;

  RETURN jsonb_build_object(
    'export_id', p_export_id,
    'status', 'manual_entry_recorded',
    'idempotent_replay', false,
    'erp_company_id', handoff_row.erp_company_id,
    'erp_costing_memo_number', handoff_row.erp_costing_memo_number,
    'erp_workflow_reference', handoff_row.erp_workflow_reference,
    'recorded_at', handoff_row.recorded_at
  );
END;
$$;

REVOKE ALL ON FUNCTION record_manual_erp_handoff(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_manual_erp_handoff(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
