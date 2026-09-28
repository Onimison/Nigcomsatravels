-- Fixes another gap in 20260926000000: request_travelers granted SELECT
-- to 'hr'/'admin' only. MD needs it too (FR-21's read-only breakdown) —
-- without this, MD_REQUEST_SELECT's request_travelers(...) embed silently
-- comes back empty for an md-role session (RLS filters rows out rather
-- than erroring), hiding the traveller breakdown from PendingCardReadOnly.

CREATE POLICY "MD can read all travellers" ON request_travelers
  FOR SELECT USING (current_staff_role() = 'md');
