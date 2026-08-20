-- Demo Travel Policy (placeholder — see TRAVEL_POLICY_DEMO.md for the full
-- write-up and rationale). Explicitly a stand-in for the real HR policy;
-- every number here is editable via Admin → Level Configuration / Rate
-- Management the moment that UI exists (it does, as of this pass — see
-- UI_UX_DESIGN_PLAN.md §3.5), no redeploy required.
--
-- Written as upserts (ON CONFLICT DO UPDATE) rather than plain INSERTs so
-- it's safe to run against a database that already has the original
-- seed.sql rows from Sprint 0, and safe to re-run.

-- ============================================================
-- Levels — coverage_percent per grade
-- ============================================================
INSERT INTO levels (name, coverage_percent, flight_class) VALUES
  ('Junior Staff',       50.00, 'economy'),
  ('Senior Staff',       60.00, 'economy'),
  ('Assistant Manager',  65.00, 'economy'),
  ('Manager',            70.00, 'economy'),
  ('Deputy Director',    80.00, 'business'),
  ('Director',           85.00, 'business'),
  ('General Manager',    90.00, 'business'),
  ('Executive Director', 100.00, 'first')
ON CONFLICT (name) DO UPDATE SET
  coverage_percent = EXCLUDED.coverage_percent,
  flight_class = EXCLUDED.flight_class;

-- ============================================================
-- Rate Reference — domestic destinations
-- All figures in USD (PRD 5.2: costs stored in USD, displayed with NGN
-- equivalent via the locked FX rate) — the original Sprint 0 seed mixed
-- NGN-scale numbers into USD columns for Lagos/Abuja; this replaces those.
-- ============================================================
INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'air', 'domestic', 120.00, 80.00, 180.00, 25.00 FROM levels l WHERE l.name = 'Junior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'air', 'domestic', 150.00, 90.00, 200.00, 25.00 FROM levels l WHERE l.name = 'Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'air', 'domestic', 220.00, 120.00, 260.00, 35.00 FROM levels l WHERE l.name = 'General Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'road', 'domestic', 120.00, 80.00, 0.00, 15.00 FROM levels l WHERE l.name = 'Junior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Abuja', l.id, 'air', 'domestic', 130.00, 85.00, 150.00, 25.00 FROM levels l WHERE l.name = 'Junior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Abuja', l.id, 'air', 'domestic', 160.00, 95.00, 170.00, 25.00 FROM levels l WHERE l.name = 'Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Abuja', l.id, 'air', 'domestic', 230.00, 130.00, 220.00, 35.00 FROM levels l WHERE l.name = 'General Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Port Harcourt', l.id, 'air', 'domestic', 125.00, 80.00, 190.00, 25.00 FROM levels l WHERE l.name = 'Senior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Kano', l.id, 'air', 'domestic', 115.00, 75.00, 170.00, 20.00 FROM levels l WHERE l.name = 'Senior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

-- ============================================================
-- Rate Reference — international destinations
-- ============================================================
INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'London', l.id, 'air', 'international', 650.00, 320.00, 950.00, 60.00 FROM levels l WHERE l.name = 'Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'London', l.id, 'air', 'international', 900.00, 420.00, 2200.00, 90.00 FROM levels l WHERE l.name = 'General Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'London', l.id, 'air', 'international', 1100.00, 500.00, 3500.00, 110.00 FROM levels l WHERE l.name = 'Executive Director'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Dubai', l.id, 'air', 'international', 600.00, 300.00, 850.00, 55.00 FROM levels l WHERE l.name = 'Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Dubai', l.id, 'air', 'international', 850.00, 400.00, 2000.00, 85.00 FROM levels l WHERE l.name = 'General Manager'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Johannesburg', l.id, 'air', 'international', 500.00, 260.00, 700.00, 45.00 FROM levels l WHERE l.name = 'Senior Staff'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;

INSERT INTO rate_reference (destination, level_id, mode, route_type, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Washington DC', l.id, 'air', 'international', 750.00, 380.00, 1400.00, 70.00 FROM levels l WHERE l.name = 'Director'
ON CONFLICT (destination, level_id, mode) DO UPDATE SET
  route_type = EXCLUDED.route_type, accommodation_rate = EXCLUDED.accommodation_rate,
  per_diem_rate = EXCLUDED.per_diem_rate, flight_estimate = EXCLUDED.flight_estimate, airport_taxi = EXCLUDED.airport_taxi;
