-- Fix infinite recursion in the "Admin full access on staff" policy
-- (Postgres error 42P17).
--
-- The live policy on `staff` had drifted from the migration history to:
--   EXISTS (SELECT 1 FROM staff staff_1 WHERE staff_1.id = auth.uid()
--           AND staff_1.role = 'admin')
-- This queries `staff` from within `staff`'s own RLS policy, so
-- evaluating it re-triggers the same policy, which queries `staff`
-- again, recursing until Postgres aborts. The previous migration
-- (20260822120000) made current_staff_role() SECURITY DEFINER so its
-- internal lookup bypasses RLS, but this policy wasn't using that
-- function — it had its own inline (and recursive) subquery. Replacing
-- it with the function closes the loop: the function's SELECT runs as
-- its owner (bypassing RLS on staff), so it resolves without recursing.
DROP POLICY IF EXISTS "Admin full access on staff" ON staff;
CREATE POLICY "Admin full access on staff" ON staff
  FOR ALL USING (current_staff_role() = 'admin');
