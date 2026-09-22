-- Grade bands and the 14-designation ladder (REVISED_SCOPE.md M1 / Phase 0b).
--
-- Coverage used to live on `levels.coverage_percent` and applied to the
-- whole request. Under the new policy, coverage is a property of the
-- *destination* (Lagos/Abuja/Port Harcourt = 100%, everywhere else = 75%),
-- and grade determines the *rate*, not a percentage. `flight_class` goes too
-- — international travel (the only thing that ever used it) is out of
-- scope for good.
--
-- Four rate bands, fourteen real NIGCOMSAT designations mapped onto them —
-- exhaustively: every level has a NOT NULL band_id, so a designation that
-- can't be mapped can't exist as a level row, and staff.level_id being null
-- is the only way a request can fail to price (refuse and route to HR,
-- never guess — enforced in the calculator, not here).

CREATE TABLE grade_bands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  dta_per_day DECIMAL(10,2) NOT NULL,
  local_running_per_day DECIMAL(10,2) NOT NULL,
  sort_order INTEGER NOT NULL
);

COMMENT ON TABLE grade_bands IS
  'Rate bands (REVISED_SCOPE.md §3). Only the 100%-coverage figures are stored — the 75% figures are derived from coverage_tiers at calculation time, so a discount-rate change is a row edit, not code.';

INSERT INTO grade_bands (code, name, dta_per_day, local_running_per_day, sort_order) VALUES
  ('B1', 'MD/CEO · Executive Director', 60000, 18000, 1),
  ('B2', 'GM · Deputy GM · Assistant GM', 40000, 12000, 2),
  ('B3', 'Senior Manager · Manager · Deputy Manager · Assistant Manager', 30000, 9000, 3),
  ('B4', 'Senior Officer and below', 15000, 4500, 4);

CREATE TABLE coverage_tiers (
  code TEXT PRIMARY KEY,
  percent DECIMAL(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100)
);

INSERT INTO coverage_tiers (code, percent) VALUES
  ('full', 100),
  ('partial', 75);

CREATE TABLE destination_coverage (
  city TEXT PRIMARY KEY,
  coverage_tier_code TEXT NOT NULL REFERENCES coverage_tiers(code)
);

COMMENT ON TABLE destination_coverage IS
  'Cities on the 100% tier. Any destination NOT listed here defaults to partial (75%) in application logic — there is no bounded list of "everywhere else" to seed.';

INSERT INTO destination_coverage (city, coverage_tier_code) VALUES
  ('Lagos', 'full'),
  ('Abuja', 'full'),
  ('Port Harcourt', 'full');

-- Rebuild levels onto the band model. Current rows are demo seed data — no
-- real staff data exists in this database yet — so this is a clean
-- replace, not a migration of existing rows. staff.level_id cascades to
-- NULL (ON DELETE SET NULL) and rate_reference's demo rows cascade away
-- (ON DELETE CASCADE) since they were keyed to the levels being dropped;
-- both are re-entered through the Admin UI against the new ladder.
ALTER TABLE levels DROP COLUMN coverage_percent;
ALTER TABLE levels DROP COLUMN flight_class;
ALTER TABLE levels ADD COLUMN band_id UUID REFERENCES grade_bands(id);
ALTER TABLE levels ADD COLUMN sort_order INTEGER;

DELETE FROM levels;

INSERT INTO levels (name, band_id, sort_order)
SELECT v.name, b.id, v.sort_order
FROM (VALUES
  ('Managing Director', 'B1', 1),
  ('Executive Director', 'B1', 2),
  ('General Manager', 'B2', 3),
  ('Deputy General Manager', 'B2', 4),
  ('Assistant General Manager', 'B2', 5),
  ('Senior Manager', 'B3', 6),
  ('Manager', 'B3', 7),
  ('Deputy Manager', 'B3', 8),
  ('Assistant Manager', 'B3', 9),
  ('Senior Officer', 'B4', 10),
  ('Senior Technical Officer', 'B4', 11),
  ('Officer I', 'B4', 12),
  ('Officer II', 'B4', 13),
  ('Assistant Officer I', 'B4', 14)
) AS v(name, band_code, sort_order)
JOIN grade_bands b ON b.code = v.band_code;

ALTER TABLE levels ALTER COLUMN band_id SET NOT NULL;

-- ============================================================
-- RLS — read access for the two new reference tables, same shape as
-- levels: any authenticated user can read (the staff form needs coverage
-- tiers to render the live estimate), only admin writes.
-- ============================================================
ALTER TABLE grade_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read grade_bands" ON grade_bands
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access grade_bands" ON grade_bands
  FOR ALL USING (current_staff_role() = 'admin');

CREATE POLICY "Authenticated users can read coverage_tiers" ON coverage_tiers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access coverage_tiers" ON coverage_tiers
  FOR ALL USING (current_staff_role() = 'admin');

CREATE POLICY "Authenticated users can read destination_coverage" ON destination_coverage
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access destination_coverage" ON destination_coverage
  FOR ALL USING (current_staff_role() = 'admin');
