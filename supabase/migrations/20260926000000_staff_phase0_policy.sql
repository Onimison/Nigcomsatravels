-- Staff Phase 0 — Domestic Travel Cost Platform rebuild (notes.md v1.1).
--
-- The PRD replaces the old FX/rate_reference/single-traveller model with a
-- memo-number entry point, a multi-traveller request, and a NGN-only
-- calculator keyed off 14 exhaustive designations mapped onto 4 grade bands
-- (§8). None of that data exists yet — this migration adds it.
--
-- Deliberately ADDITIVE, same discipline as 20260822160000_airports.sql:
-- the old levels/rate_reference/FX path stays untouched so HR, MD and Admin
-- keep working exactly as they do today against existing requests. Only the
-- staff-facing submission flow (this pass) writes the new columns/tables;
-- a later pass migrates HR/MD/Admin onto them and only then should the old
-- path be considered for removal.

-- ============================================================
-- Grade bands (§8) — the 4 rate groups the 14 designations map onto.
-- ============================================================
CREATE TABLE grade_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('B1', 'B2', 'B3', 'B4')),
  label TEXT NOT NULL,
  dta_per_day_100 DECIMAL(10, 2) NOT NULL,
  dta_per_day_75 DECIMAL(10, 2) NOT NULL,
  local_running_per_day_100 DECIMAL(10, 2) NOT NULL,
  local_running_per_day_75 DECIMAL(10, 2) NOT NULL
);

COMMENT ON TABLE grade_bands IS
  'The 4 rate groups from PRD §8. Editable by Admin (FR-23) once that UI exists — read by every authenticated role today because the live cost preview needs it client-side (NFR Performance: no network round-trip).';

INSERT INTO grade_bands (code, label, dta_per_day_100, dta_per_day_75, local_running_per_day_100, local_running_per_day_75) VALUES
  ('B1', 'Managing Director / Executive Director',                              60000.00, 45000.00, 18000.00, 13500.00),
  ('B2', 'General Manager / Deputy General Manager / Assistant General Manager', 40000.00, 30000.00, 12000.00, 9000.00),
  ('B3', 'Senior Manager / Manager / Deputy Manager / Assistant Manager',        30000.00, 22500.00, 9000.00,  6750.00),
  ('B4', 'Senior Officer / Senior Technical Officer / Officer I / Officer II / Assistant Officer I', 15000.00, 11250.00, 4500.00, 3375.00);

-- ============================================================
-- Designations (§8) — confirmed exhaustive: exactly 14, no Assistant
-- Officer II and nothing beyond this list. A designation that doesn't
-- appear here must hard-refuse the calculation (FR-13), never guess.
-- ============================================================
CREATE TABLE designations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  grade_band_id UUID NOT NULL REFERENCES grade_bands(id) ON DELETE RESTRICT
);

COMMENT ON TABLE designations IS
  'The 14-designation ladder from PRD §8, confirmed exhaustive in v1.1. Admin edits which designation maps to which band (FR-24); staff.designation_id is null until Admin assigns one, and a null must refuse the calculation rather than default to B4/zero (FR-13).';

INSERT INTO designations (name, grade_band_id)
SELECT d.name, gb.id
FROM (VALUES
  ('Managing Director', 'B1'),
  ('Executive Director', 'B1'),
  ('General Manager', 'B2'),
  ('Deputy General Manager', 'B2'),
  ('Assistant General Manager', 'B2'),
  ('Senior Manager', 'B3'),
  ('Manager', 'B3'),
  ('Deputy Manager', 'B3'),
  ('Assistant Manager', 'B3'),
  ('Senior Officer', 'B4'),
  ('Senior Technical Officer', 'B4'),
  ('Officer I', 'B4'),
  ('Officer II', 'B4'),
  ('Assistant Officer I', 'B4')
) AS d(name, band_code)
JOIN grade_bands gb ON gb.code = d.band_code;

ALTER TABLE staff
  ADD COLUMN designation_id UUID REFERENCES designations(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff.designation_id IS
  'Nullable on purpose (FR-13): a staff member Admin has not yet mapped to a designation must hard-refuse the calculator, never silently price at the lowest band.';

-- ============================================================
-- Policy defaults (§8) — flat, HR-overridable, mode-dependent only (not
-- coverage-scaled). Reuses app_settings (20260810153900) rather than a new
-- table, same pattern as the existing FX rate override.
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
  ('policy_transport_air_each_way', '150000.00'),
  ('policy_transport_road_each_way', '50000.00'),
  ('policy_airport_taxi_per_leg', '40000.00'),
  -- CSV of cities paid at 100% coverage for DTA/local running (§8). Kept as
  -- data, not a TS constant, so Admin can edit it without a deploy (FR-23)
  -- the moment a small settings editor exists for it.
  ('policy_full_coverage_cities', 'Lagos,Abuja,Port Harcourt')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- travel_requests — new Phase 0 columns (additive; old allowance/FX columns
-- untouched and simply stay null on rows created through this new path).
-- ============================================================
ALTER TABLE travel_requests
  ADD COLUMN memo_number TEXT,
  ADD COLUMN trip_type TEXT CHECK (trip_type IN ('one_way', 'return')),
  ADD COLUMN policy_snapshot JSONB,
  ADD COLUMN total_ngn DECIMAL(12, 2);

COMMENT ON COLUMN travel_requests.memo_number IS
  'The ERP memo number the HOD already approved (PRD §6 step 1). Format-validated only in Phase 0 — looked up against the ERP in Phase 3 (FR-4).';
COMMENT ON COLUMN travel_requests.policy_snapshot IS
  'The flat transport/taxi defaults and coverage tier actually used at submission, frozen so a later Admin rate change never rewrites a figure already shown or queued (FR-14). Per-traveller band rates are snapshotted on request_travelers instead, since each traveller can sit in a different band.';
COMMENT ON COLUMN travel_requests.total_ngn IS
  'Sum of request_travelers.traveller_total. Null when any traveller could not be priced (an unmapped designation, FR-13) — HR must complete those manually rather than the UI showing a partial figure as if it were authoritative.';

-- FR-32, enforced at the database, not only in application code (NFR Data
-- integrity): a memo number can be reused by a resubmission (same memo,
-- new row, old row's status has moved off the "active" set below), but two
-- rows with the same memo can never BOTH be active at once. A partial
-- unique index is the natural fit — the constraint only ever looks at rows
-- currently in flight.
CREATE UNIQUE INDEX uq_travel_requests_active_memo
  ON travel_requests (memo_number)
  WHERE status IN ('pending_hr', 'pending_md', 'approved');

-- ============================================================
-- request_travelers — one row per person on the memo (FR-5, FR-17).
-- ============================================================
CREATE TABLE request_travelers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  is_requester BOOLEAN NOT NULL DEFAULT false,

  -- Snapshotted at add-time (FR-14) — a later Admin remap of this person's
  -- designation must never rewrite a figure already shown or queued.
  designation_name TEXT NOT NULL,
  grade_band_code TEXT CHECK (grade_band_code IN ('B1', 'B2', 'B3', 'B4')),
  is_unmapped BOOLEAN NOT NULL DEFAULT false,

  -- Per-day rates actually used (post-coverage). Null exactly when
  -- is_unmapped is true — FR-13's hard refusal, not a defaulted zero.
  dta_rate_used DECIMAL(10, 2),
  local_running_rate_used DECIMAL(10, 2),
  dta_amount DECIMAL(10, 2),
  local_running_amount DECIMAL(10, 2),

  -- Transport/taxi never depend on designation, so these are always
  -- computable even for an unmapped traveller (flat, mode + trip-type only).
  transport_amount DECIMAL(10, 2) NOT NULL,
  airport_taxi_amount DECIMAL(10, 2) NOT NULL,
  -- HR's exactly-three editable fields (FR-16) — days lives trip-wide on
  -- travel_requests; these two are the per-traveller pair.
  transport_override DECIMAL(10, 2),
  airport_taxi_override DECIMAL(10, 2),

  -- Null exactly when is_unmapped — see travel_requests.total_ngn.
  traveller_total DECIMAL(10, 2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT uq_request_traveller UNIQUE (request_id, staff_id),
  CONSTRAINT unmapped_has_no_band_rates CHECK (
    (is_unmapped AND grade_band_code IS NULL AND dta_rate_used IS NULL AND local_running_rate_used IS NULL)
    OR
    (NOT is_unmapped AND grade_band_code IS NOT NULL AND dta_rate_used IS NOT NULL AND local_running_rate_used IS NOT NULL)
  )
);

COMMENT ON TABLE request_travelers IS
  'One row per person on the memo, including the requester (is_requester = true). PRD FR-5/FR-17: the requester is auto-added, colleagues come from the staff directory, and days is trip-wide while transport/taxi are set per traveller.';

CREATE INDEX idx_request_travelers_request ON request_travelers (request_id);
CREATE INDEX idx_request_travelers_staff ON request_travelers (staff_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE grade_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_travelers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read grade bands" ON grade_bands
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access grade_bands" ON grade_bands
  FOR ALL USING (current_staff_role() = 'admin');

CREATE POLICY "Authenticated users can read designations" ON designations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access designations" ON designations
  FOR ALL USING (current_staff_role() = 'admin');

-- A staff member can see every traveller row on a request they can already
-- see (their own, or one they're named on) — mirrors the "Staff can view
-- approvals on own requests" shape in the initial schema.
CREATE POLICY "Staff can view travellers on requests they can see" ON request_travelers
  FOR SELECT USING (
    staff_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM travel_requests tr
      WHERE tr.id = request_travelers.request_id AND tr.staff_id = auth.uid()
    )
  );

-- Only the requester of the parent request can add travellers to it, and
-- only while it's their own new/resubmitted row (staff_id on the parent is
-- the requester, checked the same way travel_requests' own insert policy
-- checks it).
CREATE POLICY "Requester can add travellers to their own request" ON request_travelers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM travel_requests tr
      WHERE tr.id = request_travelers.request_id AND tr.staff_id = auth.uid()
    )
  );

CREATE POLICY "HR and Admin can read all travellers" ON request_travelers
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "Admin full access request_travelers" ON request_travelers
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- Staff directory read — FR-5: "colleagues can be added from the staff
-- directory, each showing their designation." The existing "Staff can view
-- own record" policy only ever let someone read their own row; this adds a
-- second, broader read policy (RLS policies OR together, so this is purely
-- additive) so any authenticated, active person can be found and named as a
-- traveller. The server action that lists this directory still only
-- selects the columns the picker needs (name + designation), independent of
-- what this policy technically permits a direct query to reach.
-- ============================================================
CREATE POLICY "Authenticated users can read the active staff directory" ON staff
  FOR SELECT USING (auth.uid() IS NOT NULL AND active = true);
