-- Catch-up migration: four migrations were marked "applied" in the
-- migration history (via an earlier `supabase migration repair`, done
-- when `db push` failed because the base tables from 20260731144738
-- already existed on the live DB) but their actual SQL had never been
-- run against the live database. Confirmed directly via
-- information_schema/pg_policy queries:
--   - app_settings table didn't exist at all (20260810153900)
--   - "MD update status when pending_md" WITH CHECK was bare `true`,
--     missing the rejected_final fix (20260812090000)
--   - rate_reference had no route_type/updated_at/updated_by columns
--     (20260820120000) — this is why the Flight Price Reference panel
--     was broken, not just RLS-blocked: the UI queries route_type,
--     which didn't exist
--   - levels/rate_reference had none of the demo policy seed rows
--     (20260820130000) — only a single leftover "Level 1" placeholder row
--
-- This migration is those four files' content, run for real, in
-- dependency order (schema before the data that needs it). Each part is
-- verbatim from its original migration file, so it stays idempotent /
-- safe to run again.

-- ============================================================
-- From 20260810153900_app_settings.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read settings" ON app_settings;
CREATE POLICY "Authenticated users can read settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin full access app_settings" ON app_settings;
CREATE POLICY "Admin full access app_settings" ON app_settings
  FOR ALL USING (current_staff_role() = 'admin');

INSERT INTO app_settings (key, value)
VALUES ('fx_rate_usd_ngn', '1500.00')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- From 20260812090000_md_final_reject.sql
-- ============================================================
DROP POLICY IF EXISTS "MD update status when pending_md" ON travel_requests;

CREATE POLICY "MD update status when pending_md" ON travel_requests
  FOR UPDATE USING (
    current_staff_role() = 'md' AND status = 'pending_md'
  ) WITH CHECK (status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final'));

-- ============================================================
-- From 20260820120000_flight_price_reference.sql
-- ============================================================
ALTER TABLE rate_reference
  ADD COLUMN IF NOT EXISTS route_type TEXT NOT NULL DEFAULT 'domestic' CHECK (route_type IN ('domestic', 'international')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES staff(id) ON DELETE SET NULL;

-- ============================================================
-- From 20260820130000_demo_travel_policy.sql
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
