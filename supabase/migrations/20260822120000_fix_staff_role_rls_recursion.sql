-- Fix infinite recursion in RLS policies (Postgres error 42P17).
--
-- current_staff_role() queries `staff` to resolve the caller's role, but
-- `staff` has RLS enabled and its own "Admin full access" policy calls
-- current_staff_role() — every invocation of the function re-triggers
-- staff's policy evaluation, which calls the function again, recursing
-- until Postgres aborts with "infinite recursion detected in policy for
-- relation staff". This broke every policy that uses the function
-- (staff, departments, levels, rate_reference, rate_overrides,
-- rate_suggestions, travel_requests, approvals), not just login.
--
-- SECURITY DEFINER makes the function's internal SELECT run with the
-- privileges of its owner, bypassing RLS for that one lookup and
-- breaking the cycle. search_path is pinned per Postgres/Supabase
-- guidance for SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION current_staff_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM staff WHERE id = auth.uid();
$$;
