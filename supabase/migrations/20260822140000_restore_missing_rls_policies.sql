-- Restore RLS policies missing from the live database.
--
-- Diagnosis (via `supabase db query` against pg_policies/pg_class):
-- levels, rate_reference, rate_overrides, rate_suggestions, approvals,
-- and auth_audit_log all have row_security = true but ZERO policies —
-- Postgres denies all access by default in that state, so every one of
-- these tables was completely unreachable through the regular (RLS-bound)
-- client. This is what broke "Add Level" in the admin dashboard
-- ("new row violates row-level security policy for table levels") and
-- is why the flight price reference feature reads nothing — same
-- deny-all on rate_reference.
--
-- departments and travel_requests were each missing a subset of their
-- intended policies (present in 20260731144738_initial_schema.sql but
-- never applied to the live DB): departments had no general read
-- policy, so non-admin staff couldn't load it into forms; travel_requests
-- had no staff-insert or admin-full-access policy, so staff couldn't
-- submit requests and admins had no override.
--
-- These CREATE POLICY statements only add what's confirmed missing —
-- nothing here duplicates or touches policies already present.

-- LEVELS
CREATE POLICY "Authenticated users can read levels" ON levels
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access levels" ON levels
  FOR ALL USING (current_staff_role() = 'admin');

-- RATE_REFERENCE
CREATE POLICY "Authenticated users can read rates" ON rate_reference
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access rate_reference" ON rate_reference
  FOR ALL USING (current_staff_role() = 'admin');

-- RATE_OVERRIDES
CREATE POLICY "HR can insert rate overrides" ON rate_overrides
  FOR INSERT WITH CHECK (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "HR can read rate overrides" ON rate_overrides
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "Admin full access rate_overrides" ON rate_overrides
  FOR ALL USING (current_staff_role() = 'admin');

-- RATE_SUGGESTIONS (AI agent writes via service role key, bypassing RLS —
-- only reads need a policy here)
CREATE POLICY "HR and Admin can read rate suggestions" ON rate_suggestions
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "Admin full access rate_suggestions" ON rate_suggestions
  FOR ALL USING (current_staff_role() = 'admin');

-- APPROVALS
CREATE POLICY "Staff can view approvals on own requests" ON approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM travel_requests
      WHERE travel_requests.id = approvals.request_id
        AND travel_requests.staff_id = auth.uid()
    )
  );
CREATE POLICY "HR can insert approvals" ON approvals
  FOR INSERT WITH CHECK (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "HR can read all approvals" ON approvals
  FOR SELECT USING (current_staff_role() IN ('hr', 'admin'));
CREATE POLICY "MD can insert approvals" ON approvals
  FOR INSERT WITH CHECK (current_staff_role() IN ('md', 'admin'));
CREATE POLICY "MD can read all approvals" ON approvals
  FOR SELECT USING (current_staff_role() IN ('md', 'admin'));

-- AUTH_AUDIT_LOG (inserts happen via the admin/service-role client —
-- only the admin-read policy is needed)
CREATE POLICY "Admin can read auth audit log" ON auth_audit_log
  FOR SELECT USING (current_staff_role() = 'admin');

-- DEPARTMENTS — general read policy was missing (only the admin
-- full-access one existed live)
CREATE POLICY "Authenticated users can read departments" ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- TRAVEL_REQUESTS — staff-insert and admin-full-access were missing
CREATE POLICY "Staff can insert own requests" ON travel_requests
  FOR INSERT WITH CHECK (auth.uid() = staff_id);
CREATE POLICY "Admin full access travel_requests" ON travel_requests
  FOR ALL USING (current_staff_role() = 'admin');
