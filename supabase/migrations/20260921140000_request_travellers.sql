-- Request schema + travellers (REVISED_SCOPE.md M3 / Phase 0d), plus the
-- M4 policy-default rows the calculator needs to run at all, plus the
-- MD-read-only slice of M6 that has to land in the same migration as the
-- status rename it depends on (mdApproveReject retires in application
-- code in the same pass — see requests.actions.ts).
--
-- The request splits into a trip header (travel_requests) and one row per
-- traveller (request_travellers) — the shape a multi-traveller memo forces,
-- and the shape the future ERP write-back wants anyway (one memo, N cost
-- lines). `staff_id` on travel_requests keeps its existing meaning: the
-- requester. No separate requested_by column — that would just duplicate it.

-- ============================================================
-- travel_requests — new columns
-- ============================================================
ALTER TABLE travel_requests ADD COLUMN memo_number TEXT;
UPDATE travel_requests SET memo_number = 'LEGACY-' || id::text WHERE memo_number IS NULL;
ALTER TABLE travel_requests ALTER COLUMN memo_number SET NOT NULL;

ALTER TABLE travel_requests ADD COLUMN days_requested INTEGER;
UPDATE travel_requests SET days_requested = GREATEST(COALESCE(days, 1), 1);
ALTER TABLE travel_requests ALTER COLUMN days_requested SET NOT NULL;
ALTER TABLE travel_requests ADD CONSTRAINT days_requested_positive CHECK (days_requested > 0);

ALTER TABLE travel_requests ADD COLUMN days_approved INTEGER
  CHECK (days_approved IS NULL OR days_approved > 0);
ALTER TABLE travel_requests ADD COLUMN one_way BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE travel_requests ADD COLUMN policy_snapshot JSONB;
ALTER TABLE travel_requests ADD COLUMN coverage_percent_applied DECIMAL(5,2);
ALTER TABLE travel_requests ADD COLUMN request_total DECIMAL(12,2);

-- destination/origin/mode stay on the header (shared across every
-- traveller on the memo); the five old per-request allowance columns move
-- to request_travellers, one set per person.
ALTER TABLE travel_requests DROP COLUMN accommodation;
ALTER TABLE travel_requests DROP COLUMN per_diem;
ALTER TABLE travel_requests DROP COLUMN allowance_local;
ALTER TABLE travel_requests DROP COLUMN allowance_flight;
ALTER TABLE travel_requests DROP COLUMN allowance_taxi;
ALTER TABLE travel_requests DROP COLUMN total_cost;
ALTER TABLE travel_requests DROP COLUMN final_cost;
ALTER TABLE travel_requests DROP COLUMN days;

ALTER TABLE travel_requests ADD CONSTRAINT destination_not_origin CHECK (destination <> origin);

-- ============================================================
-- Status rename. The MD-approval step moves to the ERP (decision 5): HR
-- forwarding a request now means "priced and ready to hand to the ERP",
-- not "sent to the MD inside this app" — pending_md/md_rejected retire in
-- favour of the ERP-outbox-shaped states the later phases actually use.
-- rejected_final stays reserved for when Phase 5's outcome polling learns
-- the ERP-side decision was a final rejection.
-- ============================================================
UPDATE travel_requests SET status = 'hr_returned' WHERE status = 'hr_rejected';
UPDATE travel_requests SET status = 'queued_for_erp' WHERE status = 'pending_md';
UPDATE travel_requests SET status = 'rejected' WHERE status = 'md_rejected';

ALTER TABLE travel_requests DROP CONSTRAINT IF EXISTS travel_requests_status_check;
ALTER TABLE travel_requests ADD CONSTRAINT travel_requests_status_check
  CHECK (status IN ('pending_hr', 'hr_returned', 'queued_for_erp', 'in_erp', 'approved', 'rejected', 'rejected_final'));

-- A returned request can be resubmitted under the same memo number; two
-- live requests for the same memo cannot coexist.
CREATE UNIQUE INDEX travel_requests_memo_number_live_key ON travel_requests (memo_number)
  WHERE status IN ('pending_hr', 'queued_for_erp', 'in_erp', 'approved');

-- ============================================================
-- request_travellers
-- ============================================================
CREATE TABLE request_travellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id),
  -- Snapshot of the band they were priced at, in case their level changes
  -- later — mirrors travel_requests.policy_snapshot at the per-line level.
  grade_band_code TEXT NOT NULL,
  dta DECIMAL(10,2) NOT NULL DEFAULT 0,
  local_running DECIMAL(10,2) NOT NULL DEFAULT 0,
  transport_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  airport_taxi DECIMAL(10,2) NOT NULL DEFAULT 0,
  traveller_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (request_id, staff_id)
);

ALTER TABLE request_travellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view travellers on own requests or themselves" ON request_travellers
  FOR SELECT USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM travel_requests
      WHERE travel_requests.id = request_travellers.request_id
        AND travel_requests.staff_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert travellers on own requests" ON request_travellers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_requests
      WHERE travel_requests.id = request_travellers.request_id
        AND travel_requests.staff_id = auth.uid()
    )
  );

CREATE POLICY "HR read all travellers" ON request_travellers
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));

CREATE POLICY "HR update travellers while request is pending_hr" ON request_travellers
  FOR UPDATE USING (
    current_staff_role() IN ('hr', 'admin')
    AND EXISTS (
      SELECT 1 FROM travel_requests
      WHERE travel_requests.id = request_travellers.request_id
        AND travel_requests.status = 'pending_hr'
    )
  ) WITH CHECK (true);

CREATE POLICY "MD read all travellers" ON request_travellers
  FOR SELECT USING (current_staff_role() IN ('md', 'admin'));

CREATE POLICY "Admin full access request_travellers" ON request_travellers
  FOR ALL USING (current_staff_role() = 'admin');

-- A staff member picking colleagues onto a multi-traveller memo needs to
-- look other staff up by name — RLS previously let everyone see only their
-- own row. Same shape as the existing departments/levels/rate_reference
-- "authenticated users can read" policies; staff rows carry nothing more
-- sensitive than those already do to anyone signed in.
CREATE POLICY "Authenticated users can read staff directory" ON staff
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Staff read access now follows traveller membership too (decision: a
-- traveller who isn't the requester must still see the request they're on).
-- ============================================================
DROP POLICY IF EXISTS "Staff select own requests" ON travel_requests;
CREATE POLICY "Staff select own requests" ON travel_requests
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (
      SELECT 1 FROM request_travellers
      WHERE request_travellers.request_id = travel_requests.id
        AND request_travellers.staff_id = auth.uid()
    )
  );

-- ============================================================
-- MD approval retires from this app (decision 5 — the MD now approves in
-- the ERP). No replacement UPDATE policy: MD gets read-only access.
-- ============================================================
DROP POLICY IF EXISTS "MD update status when pending_md" ON travel_requests;

DROP POLICY IF EXISTS "MD read pending/approved/rejected" ON travel_requests;
CREATE POLICY "MD read forwarded requests" ON travel_requests
  FOR SELECT USING (
    current_staff_role() = 'md'
    AND status NOT IN ('pending_hr', 'hr_returned')
  );

-- rate_overrides now logs a deviation on one traveller's line, not the
-- request as a whole (a multi-traveller memo needs to know which
-- traveller's transport/taxi HR changed).
ALTER TABLE rate_overrides ADD COLUMN traveller_id UUID REFERENCES request_travellers(id) ON DELETE CASCADE;

-- ============================================================
-- Policy defaults (M4) — the calculator's HR-overridable defaults.
-- Admin editors for these land in Phase 0e; the rows need to exist now for
-- the calculator to have anything to read.
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
  ('policy_air_fare_per_leg', '150000'),
  ('policy_road_fare_per_leg', '50000'),
  ('policy_taxi_per_leg', '40000')
ON CONFLICT (key) DO NOTHING;
