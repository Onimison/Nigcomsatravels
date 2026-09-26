-- Fixes a gap in 20260926000000: request_travelers had SELECT for HR/Admin
-- and INSERT for the requester, but no UPDATE policy for HR at all — only
-- Admin's blanket "FOR ALL" covered it. hrReviewRequestV2 (FR-16/FR-17)
-- upserts each traveller's recomputed dta/local + HR's transport/taxi
-- overrides, which for a plain 'hr' role would silently be filtered to
-- zero rows by RLS. Mirrors "HR update allowances only when pending_hr" on
-- travel_requests exactly, scoped through the parent row since
-- request_travelers has no status column of its own.

CREATE POLICY "HR can update travellers while pending_hr" ON request_travelers
  FOR UPDATE USING (
    current_staff_role() = 'hr'
    AND EXISTS (
      SELECT 1 FROM travel_requests tr
      WHERE tr.id = request_travelers.request_id AND tr.status = 'pending_hr'
    )
  ) WITH CHECK (true);
