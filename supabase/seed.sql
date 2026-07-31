-- ============================================================
-- SEED DATA: Default departments, levels, and sample rate data
-- PRD Sprint 0 deliverable
-- ============================================================

-- Departments (PRD Section 4 — departments table)
INSERT INTO departments (name, annual_budget_ceiling) VALUES
  ('Engineering', 500000.00),
  ('Finance', 300000.00),
  ('Human Resources', 250000.00),
  ('Operations', 400000.00),
  ('Legal', 200000.00),
  ('Communications', 150000.00),
  ('Management', 750000.00);

-- Levels (PRD Section 4 — levels table)
-- coverage_percent determines how much of the total cost NIGCOMSAT covers
INSERT INTO levels (name, coverage_percent, flight_class) VALUES
  ('Junior Staff',    60.00, 'economy'),
  ('Senior Staff',    70.00, 'economy'),
  ('Assistant Manager', 75.00, 'economy'),
  ('Manager',         80.00, 'economy'),
  ('Deputy Director', 85.00, 'business'),
  ('Director',        90.00, 'business'),
  ('General Manager', 95.00, 'business'),
  ('Executive',      100.00, 'first');

-- Sample Rate Reference Data (PRD Section 4 — rate_reference table)
-- These are starter rates; Admin will manage via the Admin Dashboard UI
INSERT INTO rate_reference (destination, level_id, mode, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'air', 25000.00, 15000.00, 85000.00, 5000.00
FROM levels l WHERE l.name = 'Senior Staff';

INSERT INTO rate_reference (destination, level_id, mode, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Lagos', l.id, 'road', 25000.00, 15000.00, 0.00, 3000.00
FROM levels l WHERE l.name = 'Senior Staff';

INSERT INTO rate_reference (destination, level_id, mode, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Abuja', l.id, 'air', 30000.00, 18000.00, 65000.00, 5000.00
FROM levels l WHERE l.name = 'Senior Staff';

INSERT INTO rate_reference (destination, level_id, mode, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'London', l.id, 'air', 150.00, 100.00, 1200.00, 50.00
FROM levels l WHERE l.name = 'Director';

INSERT INTO rate_reference (destination, level_id, mode, accommodation_rate, per_diem_rate, flight_estimate, airport_taxi)
SELECT 'Dubai', l.id, 'air', 200.00, 120.00, 900.00, 40.00
FROM levels l WHERE l.name = 'Director';
