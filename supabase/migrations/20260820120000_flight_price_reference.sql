-- Flight Price Reference — "Sprint 4" (redefined scope, see UI_UX_DESIGN_PLAN.md §4).
--
-- Full Reporting & Audit (original PRD Sprint 4) stays deferred. What's
-- needed now: HR needs an always-current, always-visible reference for
-- flight prices (domestic and international) while reviewing requests.
--
-- Rather than a new parallel table (which would create two sources of truth
-- for flight cost alongside the existing rate_reference.flight_estimate,
-- already wired into "Suggest Standard Rates"), this extends rate_reference
-- with the two columns that were missing to support that: an explicit
-- domestic/international split, and staleness tracking.

ALTER TABLE rate_reference
  ADD COLUMN route_type TEXT NOT NULL DEFAULT 'domestic' CHECK (route_type IN ('domestic', 'international')),
  ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN updated_by UUID REFERENCES staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN rate_reference.route_type IS
  'Domestic (within Nigeria) vs international — drives the Flight Price Reference grouping on the Admin and HR dashboards.';
COMMENT ON COLUMN rate_reference.updated_at IS
  'Stamped on every insert/update by rates.actions.ts so HR can see how stale a reference price is.';
