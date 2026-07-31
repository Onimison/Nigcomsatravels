-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  annual_budget_ceiling DECIMAL(12,2)
);

-- 2. levels
CREATE TABLE levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  coverage_percent DECIMAL(5,2) NOT NULL CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
  flight_class TEXT
);

-- 3. staff (extends Supabase auth.users)
CREATE TABLE staff (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  surname TEXT,
  role TEXT NOT NULL CHECK (role IN ('staff', 'hr', 'md', 'admin')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  level_id UUID REFERENCES levels(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. rate_reference
CREATE TABLE rate_reference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination TEXT NOT NULL,
  level_id UUID REFERENCES levels(id) ON DELETE CASCADE,
  mode TEXT,  -- e.g., 'air', 'road'
  accommodation_rate DECIMAL(10,2),
  per_diem_rate DECIMAL(10,2),
  flight_estimate DECIMAL(10,2),
  airport_taxi DECIMAL(10,2),
  UNIQUE(destination, level_id, mode)
);

-- 5. rate_overrides
CREATE TABLE rate_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,  -- will be added after travel_requests is created
  field_name TEXT NOT NULL,
  overridden_value DECIMAL(10,2),
  hr_staff_id UUID NOT NULL REFERENCES staff(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. rate_suggestions (AI write target)
CREATE TABLE rate_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination TEXT NOT NULL,
  suggested_rate DECIMAL(10,2),
  source TEXT,  -- e.g., 'AI agent'
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. travel_requests
CREATE TABLE travel_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  travel_group_id UUID NOT NULL,  -- generated on first submission
  previous_version_id UUID REFERENCES travel_requests(id) ON DELETE SET NULL,
  staff_id UUID NOT NULL REFERENCES staff(id),
  destination TEXT NOT NULL,
  origin TEXT,
  mode TEXT,
  days INTEGER CHECK (days > 0),
  reason_for_travel TEXT,
  -- five allowance fields
  allowance_local DECIMAL(10,2),
  allowance_flight DECIMAL(10,2),
  allowance_taxi DECIMAL(10,2),
  accommodation DECIMAL(10,2),
  per_diem DECIMAL(10,2),
  total_cost DECIMAL(10,2),          -- raw total before coverage
  final_cost DECIMAL(10,2),          -- after coverage applied
  status TEXT NOT NULL CHECK (status IN ('pending_hr','pending_md','hr_rejected','md_rejected','rejected_final','approved')),
  locked_fx_rate DECIMAL(10,4),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  depart_date DATE NOT NULL,
  return_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add foreign key for rate_overrides after travel_requests exists
ALTER TABLE rate_overrides ADD CONSTRAINT fk_request FOREIGN KEY (request_id) REFERENCES travel_requests(id) ON DELETE CASCADE;

-- 8. approvals
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES staff(id),
  status TEXT NOT NULL CHECK (status IN ('hr_approved','md_approved','hr_rejected','md_rejected')),
  reason TEXT,
  is_final BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- PRD 5.4: Mandatory rejection reason enforced at DB level
  CONSTRAINT rejection_requires_reason CHECK (
    status NOT IN ('hr_rejected', 'md_rejected') OR reason IS NOT NULL
  )
);

-- 9. auth_audit_log
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  success BOOLEAN,
  ip_address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on ALL tables
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get app role from staff table (PRD Section 7.1)
CREATE OR REPLACE FUNCTION current_staff_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT role FROM staff WHERE id = auth.uid();
$$;

-- ============================================================
-- STAFF TABLE POLICIES
-- ============================================================
CREATE POLICY "Staff can view own record" ON staff
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin full access on staff" ON staff
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- DEPARTMENTS TABLE POLICIES
-- ============================================================
-- All authenticated users can read departments (needed for forms)
CREATE POLICY "Authenticated users can read departments" ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access departments" ON departments
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- LEVELS TABLE POLICIES
-- ============================================================
-- All authenticated users can read levels (needed for forms/display)
CREATE POLICY "Authenticated users can read levels" ON levels
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access levels" ON levels
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- RATE_REFERENCE TABLE POLICIES
-- ============================================================
-- Authenticated users can read rates (needed for pre-submit estimates)
CREATE POLICY "Authenticated users can read rates" ON rate_reference
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access rate_reference" ON rate_reference
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- TRAVEL_REQUESTS TABLE POLICIES (PRD Section 7.1)
-- ============================================================
-- Staff: See only their own requests
CREATE POLICY "Staff select own requests" ON travel_requests
  FOR SELECT USING (auth.uid() = staff_id);
-- Staff: Can INSERT new requests
CREATE POLICY "Staff can insert own requests" ON travel_requests
  FOR INSERT WITH CHECK (auth.uid() = staff_id);

-- HR: See all requests
CREATE POLICY "HR read all requests" ON travel_requests
  FOR SELECT USING (current_staff_role() = 'hr');
-- HR: Update allowances only when pending_hr
CREATE POLICY "HR update allowances only when pending_hr" ON travel_requests
  FOR UPDATE USING (
    current_staff_role() = 'hr' AND status = 'pending_hr'
  ) WITH CHECK (true);

-- MD: See pending approvals and history
CREATE POLICY "MD read pending/approved/rejected" ON travel_requests
  FOR SELECT USING (
    current_staff_role() = 'md'
    AND status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final')
  );
-- MD: Update status when pending_md
CREATE POLICY "MD update status when pending_md" ON travel_requests
  FOR UPDATE USING (
    current_staff_role() = 'md' AND status = 'pending_md'
  ) WITH CHECK (status IN ('pending_md', 'approved', 'md_rejected'));

-- Admin: Full access
CREATE POLICY "Admin full access travel_requests" ON travel_requests
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- APPROVALS TABLE POLICIES
-- ============================================================
CREATE POLICY "Staff can view approvals on own requests" ON approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM travel_requests
      WHERE travel_requests.id = approvals.request_id
        AND travel_requests.staff_id = auth.uid()
    )
  );
-- HR can insert approvals
CREATE POLICY "HR can insert approvals" ON approvals
  FOR INSERT WITH CHECK (current_staff_role() IN ('hr', 'admin'));
-- HR can read all approvals
CREATE POLICY "HR can read all approvals" ON approvals
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
-- MD can insert approvals
CREATE POLICY "MD can insert approvals" ON approvals
  FOR INSERT WITH CHECK (current_staff_role() IN ('md', 'admin'));
-- MD can read all approvals
CREATE POLICY "MD can read all approvals" ON approvals
  FOR SELECT USING (current_staff_role() IN ('md', 'admin'));

-- ============================================================
-- RATE_OVERRIDES TABLE POLICIES
-- ============================================================
CREATE POLICY "HR can insert rate overrides" ON rate_overrides
  FOR INSERT WITH CHECK (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "HR can read rate overrides" ON rate_overrides
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "Admin full access rate_overrides" ON rate_overrides
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- RATE_SUGGESTIONS TABLE POLICIES
-- ============================================================
-- Read-only for HR/Admin (AI agent writes via service role key)
CREATE POLICY "HR and Admin can read rate suggestions" ON rate_suggestions
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "Admin full access rate_suggestions" ON rate_suggestions
  FOR ALL USING (current_staff_role() = 'admin');

-- ============================================================
-- AUTH_AUDIT_LOG TABLE POLICIES
-- ============================================================
-- Only admin can read audit logs; inserts happen via service role
CREATE POLICY "Admin can read auth audit log" ON auth_audit_log
  FOR SELECT USING (current_staff_role() = 'admin');