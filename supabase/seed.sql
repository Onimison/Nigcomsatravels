-- ============================================================
-- SEED DATA: Default departments
-- PRD Sprint 0 deliverable
--
-- Levels and rate_reference used to be seeded here too, but that data has
-- moved into supabase/migrations/20260820130000_demo_travel_policy.sql
-- (see TRAVEL_POLICY_DEMO.md) so it applies to *every* environment exactly
-- once via the normal migration path, rather than only on `db reset` — and
-- so a fresh `db reset` doesn't try to INSERT the same level names twice
-- (once from the migration, once from here) and fail on the UNIQUE
-- constraint.
-- ============================================================

INSERT INTO departments (name, annual_budget_ceiling) VALUES
  ('Engineering', 500000.00),
  ('Finance', 300000.00),
  ('Human Resources', 250000.00),
  ('Operations', 400000.00),
  ('Legal', 200000.00),
  ('Communications', 150000.00),
  ('Management', 750000.00)
ON CONFLICT (name) DO NOTHING;
