-- Allow a staff member to withdraw a request that HR has not started processing.
-- Withdrawal is a terminal, auditable state; submitted rows are never deleted.

ALTER TABLE travel_requests
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES staff(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

ALTER TABLE travel_requests
  DROP CONSTRAINT IF EXISTS travel_requests_status_check;

ALTER TABLE travel_requests
  ADD CONSTRAINT travel_requests_status_check CHECK (
    status IN ('pending_hr', 'pending_md', 'hr_rejected', 'md_rejected', 'rejected_final', 'approved', 'withdrawn')
  );

ALTER TABLE travel_requests
  DROP CONSTRAINT IF EXISTS travel_requests_withdrawal_fields_check;

ALTER TABLE travel_requests
  ADD CONSTRAINT travel_requests_withdrawal_fields_check CHECK (
    status <> 'withdrawn'
    OR (
      withdrawn_at IS NOT NULL
      AND withdrawn_by IS NOT NULL
      AND withdrawal_reason IS NOT NULL
      AND length(btrim(withdrawal_reason)) BETWEEN 1 AND 500
    )
  );

CREATE OR REPLACE FUNCTION withdraw_travel_request_v1(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  request_row travel_requests%ROWTYPE;
  normalized_reason TEXT := btrim(p_reason);
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL
     OR normalized_reason IS NULL
     OR length(normalized_reason) < 1
     OR length(normalized_reason) > 500 THEN
    RAISE EXCEPTION 'A withdrawal reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO request_row
  FROM travel_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Travel request was not found' USING ERRCODE = 'P0002';
  END IF;

  IF request_row.staff_id <> actor_id THEN
    RAISE EXCEPTION 'Only the requester can withdraw this travel request' USING ERRCODE = '42501';
  END IF;

  -- A retry after a lost response is safe and does not create a second event.
  IF request_row.status = 'withdrawn' THEN
    RETURN jsonb_build_object(
      'request_id', request_row.id,
      'status', 'withdrawn',
      'idempotent_replay', true,
      'withdrawn_at', request_row.withdrawn_at
    );
  END IF;

  IF request_row.status <> 'pending_hr' THEN
    RAISE EXCEPTION 'Only requests awaiting HR review can be withdrawn' USING ERRCODE = 'P0009';
  END IF;

  UPDATE travel_requests
  SET status = 'withdrawn',
      withdrawn_at = now(),
      withdrawn_by = actor_id,
      withdrawal_reason = normalized_reason,
      updated_at = now()
  WHERE id = request_row.id
    AND staff_id = actor_id
    AND status = 'pending_hr';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The request changed before it could be withdrawn' USING ERRCODE = 'P0009';
  END IF;

  RETURN jsonb_build_object(
    'request_id', request_row.id,
    'status', 'withdrawn',
    'idempotent_replay', false,
    'withdrawn_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION withdraw_travel_request_v1(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION withdraw_travel_request_v1(UUID, TEXT) TO authenticated;
