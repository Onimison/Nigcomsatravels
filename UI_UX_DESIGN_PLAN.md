# UI/UX Design Plan — NIGCOMSAT Travel

**Written:** 2026-08-20 · **Author role:** Senior Product Designer (embedded) · **Status:** Living doc, extends `IMPLEMENTATION_PLAN.md`

## 0. Brief

Iyinoluwa (the intern) designed the Staff Dashboard in Figma — see `ui-images/Screenshot 2026-08-20 at 11.15.17.png`. It's good work: a clean, confident admin-tool layout with a clear visual hierarchy. Nothing else in the app has been designed to that level yet — the HR, MD, and Admin dashboards, and the shared dashboard chrome (`src/app/(dashboard)/layout.tsx`), are functional but visually unstyled scaffolding (literally has `{/* TODO: Extract to Sidebar.tsx */}` comments in it today).

My job here isn't to redesign what she made — it's to reverse-engineer her design language into a reusable system, and extend that system, consistently, to everything she didn't get to. Her dashboard is the constitution; everything below builds on top of it, not around it.

I'm not touching what already works end-to-end (the request/review/approve pipeline logic, the RLS model, the server actions) — this is a visual and structural layer over it.

---

## 1. Design Language Extracted From the Reference

Reading the screenshot directly, plus cross-checking against what's already half-built in `src/components/ui/` (which independently converged on the same blue accent — good sign the codebase and the Figma agree):

| Token | Value | Where it already shows up |
|---|---|---|
| Accent | `blue-600` (#2563eb), hover `blue-700` | `Button` primary variant, links, active nav state |
| Surface | white / `gray-900` dark, `rounded-xl` cards, `border-gray-200` | every dashboard section today |
| Page background | `gray-50` / `gray-950` dark | `(dashboard)/layout.tsx` |
| Sidebar | white, `w-64`, right border, logo lockup + nav + user footer | present but empty (no nav links, no icons) |
| Status pills | `rounded-full`, tinted bg/text pair per status | already centralized in `StatusBadge` — **do not rebuild, reuse** |
| Stat tile | icon badge (tinted square, `rounded-xl`) + big number + label | **does not exist yet** — new component |
| Table | plain `<table>`, uppercase gray-400 header, row borders, pill status column, blue text links for row actions | exists as ad-hoc markup in HR/MD, needs a staff-facing version |
| Type scale | `text-2xl font-bold` page title, `text-lg font-semibold` section header, `text-sm` body, `text-xs` meta | consistent already |

One more thing worth naming: `src/components/auth/brand-panel.tsx` (login screen) already built its own version of the NIGCOMSAT lockup — blue rounded-square icon mark (`EyeMark`) + "NIGCOMSAT" / "TRAVELS" wordmark — independently of the intern's dashboard Figma, and it happens to match her sidebar logo treatment almost exactly. That's the brand mark. The dashboard sidebar should reuse it verbatim rather than reinvent a third variant.

---

## 2. Component Inventory (what gets built once, used everywhere)

New, shared, built during this pass:

1. **`src/components/ui/icons.tsx`** — dashboard icon set (grid, plane, clock, history, user, logout, bell, home, chevron). Mirrors the existing `components/auth/icons.tsx` pattern (inline SVG, no icon library — same rationale: too small a surface to justify a dependency).
2. **`src/lib/utils/nav-config.ts`** — role → nav items map. One source of truth for what each role sees in the sidebar, so adding a route later means editing one array, not four dashboards.
3. **`src/components/dashboard/sidebar.tsx`** + **`topbar.tsx`** + **`dashboard-chrome.tsx`** — replaces the inline `<aside>`/`<header>` markup currently sitting directly in `layout.tsx`. Active-route highlighting, mobile drawer, badge counts (e.g. the blue "3" pill next to "Pending Requests" in the reference).
4. **`src/components/ui/stat-tile.tsx`** — the 4-tile row pattern (icon badge + number + label). Used on Staff, and reused (with different metrics) on HR/MD/Admin.
5. **`src/components/ui/page-header.tsx`** — title + subtitle + optional primary action button, right-aligned. Replaces the hand-rolled header markup repeated at the top of every dashboard page today.

Nothing else needs to be "componentized" — HR/MD's review-card markup is already consistent and fine as-is; forcing it into a generic `<DataTable>` abstraction would cost more than it saves given how different each role's columns/actions are.

---

## 3. Page-by-Page Plan

### 3.1 Shared dashboard chrome — `(dashboard)/layout.tsx`
Today: a static sidebar with no nav links and a topbar with no bell/avatar (see the TODO comments in the file). Replace with `DashboardChrome`:
- Logo lockup = `EyeMark` + "NIGCOMSAT / TRAVELS", matching the login brand panel.
- Nav rendered from `nav-config.ts`, filtered by `staff.role`, active item gets `bg-blue-50 text-blue-700`.
- A live badge count on the role's primary queue item (Staff → their own active requests; HR → `pending_hr` count; MD → `pending_md` count) — cheap `count()` queries added to the existing per-role data fetches, not a new subsystem.
- Topbar: page title (passed per-route), bell icon (static for now — there's no notification backend; it's a visual placeholder, not wired to fake data), avatar circle with initials, name + role/department caption.
- Mobile: nav collapses behind the existing hamburger button (already stubbed, just needs the drawer wired up).

### 3.2 Staff — matches the Figma directly
The reference screenshot is a pure **overview**, not a form page — no request form is visible on it at all. That's a deliberate signal: "Request Travel" is its own destination, not inline clutter on the dashboard. Splitting into routes (cheap — the data-fetching logic in `requests.actions.ts` already supports it, this is just presentation):

- **`/staff`** — Welcome banner (name in blue, `+ Request Travel` CTA), 4 stat tiles (Pending / Approved / Returned for Revision / Ongoing Trip — all derivable from the existing `getMyRequests()` result, no new queries), Pending Requests table (Request ID / Destination / Departure / Return / Status / Action), Ongoing Trip card, Recent Travel History (last 5).
- **`/staff/request`** — the existing `TravelRequestForm`, unchanged logic, moved here. Resubmit flow becomes `?resubmit=<id>`.
- **`/staff/pending`** — full pending list (today's "Pending Requests" section, just promoted to its own page).
- **`/staff/history`** — full grouped travel history (today's "Travel History" section).
- **`/staff/profile`** — read-only staff details (name, email, role, department, level, coverage %). No self-edit action exists in the backend and the PRD doesn't ask for one — this is a lookup page, not a settings page.

"Request ID" in the reference (`TRQ-2025-041`) is cosmetic formatting over the UUID `id` — I generate a display label (`TRQ-{year}-{shortId}`) client-side rather than adding a real sequence column; nothing downstream depends on it being sequential.

### 3.3 HR Dashboard
No Figma reference exists for this screen, so I'm extending the system, not guessing blind: same shell, `PageHeader`, and a stat-tile row (Awaiting Review / Resubmissions in queue / Processed today) above the existing (functionally solid, keep as-is) review-card list and filters. This is additive polish, not a rewrite — the review card interaction (Suggest Standard Rates, live total, overlap flag, resubmission context) already correctly implements PRD 3.2 and isn't being touched.

### 3.4 MD Dashboard
Same treatment as HR: shell + `PageHeader` + stat tiles (Pending Approval / Approved this month / Rejected). Existing sort/filter/cost-breakdown/reason-pair markup stays — it's correct and already matches the visual language.

### 3.5 Admin Dashboard
Gets the shell + `PageHeader` treatment, plus it's where the two functional gaps get closed (see §4 and §5 below — both land inside Admin, since PRD 3.4 already scopes Level/Rate management as admin-owned):
- **Level Configuration** (currently a placeholder) — list + inline-edit `coverage_percent`/`flight_class`. This is the actual mechanism the travel policy runs on (§5), so it needs a real UI, not just seed rows nobody can change without SQL.
- **Rate Management**, with **Flight Price Reference** as the flagship section inside it (§4) — this is this pass's "Sprint 4."
- Department Management stays a placeholder — out of scope for this pass (nothing today depends on editable budget ceilings; `FEATURE_FLAGS.BUDGET_AWARENESS` is already off).

### 3.6 Auth pages
Already done, already matches a reference (`login-form.tsx`/`verify-otp-form.tsx` comments say so explicitly). No changes needed here — noting it only so this plan is a complete map of the app, not because there's work to do.

---

## 4. "Sprint 4" (Redefined) — Flight Price Reference

Full Reporting & Audit (PRD §6) is explicitly deferred — the ask right now is narrower and more urgent: HR needs an always-current, always-visible reference for flight prices (domestic and international) while reviewing requests, not another manual-entry burden.

Rather than a new parallel table (which would create two sources of truth for flight cost — `rate_reference.flight_estimate` already exists and already feeds "Suggest Standard Rates"), this extends `rate_reference`:
- `route_type` (`domestic` | `international`) — explicit column, not a guess from destination string matching.
- `updated_at` / `updated_by` — so staleness is visible ("Updated 3 days ago" vs. "Updated 94 days ago — verify before relying on this").

Two surfaces:
- **Admin → Rate Management → Flight Price Reference**: full CRUD table, grouped by route type, sorted by recency, with an add/edit form (destination, level, mode, route type, price).
- **HR Dashboard**: a compact, always-visible reference panel (not buried per-request) listing current tracked flight prices grouped domestic/international, so HR can sanity-check a number without opening each request individually — plus the existing per-request "Suggest Standard Rates" now surfaces the same staleness note inline.

See `IMPLEMENTATION_PLAN.md` for how this interacts with the rest of the rate engine (accommodation/per-diem/taxi stay level-scoped and untouched).

---

## 5. Demo Travel Policy

Covered in full in `TRAVEL_POLICY_DEMO.md` — summary: a coverage-percent-per-grade model (fits the existing schema with zero code changes — `Final_Cost = Total_Raw_Allowance × coverage_percent/100` already exists in `formatting.ts`), plus destination-scoped `rate_reference` rows so the same grade gets different reference numbers for, say, Lagos vs. London. Explicitly marked as a placeholder to be replaced by the real HR policy — every number in it is editable via the Admin UI in §3.5 the moment it's built, no redeploy required.

---

## 6. Sequencing

1. This document.
2. Shared dashboard chrome (§3.1) — small, mechanical, and a prerequisite: building it first means Flight Price Reference's own UI (next) and everything after it gets built once, styled, rather than plain-then-restyled.
3. Flight Price Reference (§4) — the one piece HR needs immediately; this is what "Sprint 4" now means for this build.
4. Staff dashboard split + redesign (§3.2).
5. HR/MD/Admin polish pass (§3.3–3.5).
6. Demo travel policy seed data (§5).
7. Internal test account seeding (`TESTING_SETUP.md`).

Full Reporting & Audit (original PRD Sprint 4) remains backlog — not started, not scaffolded, intentionally.
