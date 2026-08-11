-- Fix: "MD update status when pending_md" was missing 'rejected_final' from
-- its WITH CHECK, so an MD final rejection (PRD 3.3 — "If marked Final,
-- resubmission is blocked") would be silently rejected by RLS.
-- Sprint 3 — MD Dashboard.

DROP POLICY IF EXISTS "MD update status when pending_md" ON travel_requests;

CREATE POLICY "MD update status when pending_md" ON travel_requests
  FOR UPDATE USING (
    current_staff_role() = 'md' AND status = 'pending_md'
  ) WITH CHECK (status IN ('pending_md', 'approved', 'md_rejected', 'rejected_final'));
