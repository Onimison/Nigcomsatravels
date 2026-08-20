# Implementation Plan — Path to Testable Build

**Written:** 2026-08-18 · **Deadline:** 2026-08-22 (4 days) · **Status:** Living doc — update as sprints close

This plan is based on an audit of the actual code in `main` (not just `notes.md`), the open branches, and the `frontend/` folder — not assumptions. Section 1 is what's *actually true today*, verified file-by-file. Section 2 is what will bite you if it's not addressed before you build on top of it. Section 3 is the day-by-day path to a demoable, testable build. Read section 2 first.

---

## 1. Verified Current State

| Sprint | PRD Area | Status | Evidence |
|:---|:---|:---|:---|
| 0 | Admin CRUD (staff/levels/rates/depts) | 🟡 Backend done for all four; UI done for **staff** only (see Day 3 notes below) | `staff.actions.ts`, `levels.actions.ts`, `departments.actions.ts`, `rates.actions.ts`, `admin/page.tsx`, `src/components/admin/staff-management.tsx` |
| 1 | Staff dashboard + request form | ✅ Merged | `staff-dashboard.tsx`, `travel-request-form.tsx`, `useOverlapWarning.ts` |
| — | Auth (OTP login) | ✅ Real implementation on `main`, styled | `auth.actions.ts`, `login-form.tsx`, `verify-otp-form.tsx` |
| 2 | HR dashboard | ✅ Merged | `requests.actions.ts` (`getPendingHRRequests()`/`hrReviewRequest()`), `hr-dashboard.tsx` |
| 3 | MD dashboard | ✅ Merged | `md-dashboard.tsx`, `mdApproveReject()` |
| 4 | Reporting & Audit | ❌ Not started | no files exist |
| 5 | AI rate suggestions | ❌ Not started (optional, correctly deferred) |
| DB | Schema + RLS | ✅ Solid | `supabase/migrations/*.sql` — RLS policies exist for every table including the roles matrix in the PRD |

**Bottom line:** the review/approval pipeline now runs start-to-end (staff → HR → MD). What's left is Admin's Level/Rate/Department sections (still placeholders) and Sprint 4 reporting.

---

## 2. Blockers to Resolve *Before* Building Further

### 2.1 🔴 The in-progress auth branch will delete merged work if merged as-is
`origin/feature/auth-otp-users` branched from commit `5b6f2b0`, which is **before** Sprint 0, Sprint 1, and Sprint 3 were merged into `main`. Diffing it against current `main` shows it **deletes**:
- `md-dashboard.tsx` (373 lines), `staff-dashboard.tsx` (202 lines), `travel-request-form.tsx` (313 lines)
- `departments.actions.ts`, `levels.actions.ts`, `rates.schema.ts`, `level.schema.ts`, `department.schema.ts`
- `auth-guard.ts`, and the two most recent migrations

This isn't a code problem, it's a branch-freshness problem — whoever is implementing auth branched too early and hasn't rebased since. **Do not let this get merged via GitHub's merge button.** Before it goes anywhere near `main`:
1. Whoever owns that branch (or you) rebases it onto current `main`: `git rebase main` on `feature/auth-otp-users`, resolving conflicts by keeping `main`'s versions of everything except the actual auth files (`auth.actions.ts`, `login/page.tsx`, `verify-otp/page.tsx`, `proxy.ts`).
2. Given the 4-day clock, consider just taking over the auth implementation directly against current `main` instead of waiting on the rebase — the actual auth logic needed is small (see 2.2), and re-doing it cleanly may be faster than untangling a stale branch.

### 2.2 🔴 `auth.actions.ts` on `main` is a stub, and the one real code path has a bug
Current `sendOtp`/`verifyOtp` are marked `TODO` and skip everything the PRD requires:
- No `staff.active` check before sending an OTP (PRD 2.3) — a deactivated staff member can still request and receive a login code.
- No writes to `auth_audit_log` anywhere in the codebase — the table exists and has RLS, nothing ever inserts into it.
- `verifyOtp` fetches role with `.from('staff').select('role').single()` — no `.eq('id', user.id)` filter. For a `staff`/`hr`/`md` user this works only because RLS happens to restrict them to their own row. **For an `admin`, RLS grants read access to *all* staff rows, so `.single()` receives multiple rows, throws, `staff` comes back `null`, and the code silently falls back to `role ?? 'staff'`** — an admin logging in gets routed to `/staff` instead of `/admin`. Add the explicit filter regardless of what RLS allows; never rely on RLS to save you from a missing `WHERE`.

### 2.3 🔴 No SMTP / OTP email template configured — this is a Supabase Dashboard task, not code
`supabase/config.toml` has no `[auth.email]` / SMTP block, and nothing in the repo configures a numeric-code template. Two separate problems:
- **Template:** Supabase's default confirmation email sends a magic *link*, not a 6-digit code. The PRD requires a plain numeric code (`{{ .Token }}`) — this must be set in Supabase Dashboard → Authentication → Email Templates (or via `config.toml` `[auth.email.template.magic_link]` if you're managing it as code, which is preferable so it's versioned).
- **SMTP:** Supabase's built-in email sending is aggressively rate-limited (a handful of emails/hour on the free tier) — it will not survive multiple staff testing logins in the same day. You need a real SMTP provider (Resend, Postmark, SES) wired into Supabase Auth settings before any multi-user testing.

This is infrastructure, not a coding task — flag it to whoever has Supabase project admin access today, since provider signup/verification can itself eat a day.

### 2.4 🟡 `frontend/` is a disconnected component library, not wired into the app
`frontend/components/ui/*` (Button, Card, Input, Select, Table, StatusBadge, DatePicker) has its own `package.json` and is never imported anywhere in `src/`. All existing dashboards (`staff-dashboard.tsx`, `md-dashboard.tsx`, `admin/page.tsx`) hand-roll Tailwind markup directly instead. Two more mismatches if you plan to use it as-is:
- `frontend/constants/requeststatus.ts` uses a generic `pending/approved/rejected/processing/cancelled` status set, while the real enum (`src/lib/utils/constants.ts`) has the 6 PRD-specific statuses (`pending_hr`, `md_rejected`, `rejected_final`, etc). It will silently produce wrong colors/labels if used as-is.
- `login/page.tsx` has a comment saying "style with ShadCN/Radix" — i.e. Sprint 1 assumed a different component approach than what the intern built. There's no single source of truth for the design system right now.

This is exactly the "use what she made as a guide" work — see §4 for how to fold it in without a risky full rewrite mid-crunch.

### 2.5 🟡 Reporting & Audit (Sprint 4) has zero scaffolding
Not a blocker for the approval pipeline, but if "testing the platform" includes finance/audit views, budget zero days for it right now — nothing exists, not even a route.

---

## 3. Day-by-Day Plan (4 days to a testable build)

**Day 1 (today) — Unblock auth, stop the bleeding**
- Decide & execute §2.1 (rebase the stale branch, or re-implement auth directly on `main` — recommend the latter given the timeline).
- Fix `auth.actions.ts`: active-staff check, `auth_audit_log` writes (success + failure), the `.eq('id', user.id)` role-fetch bug.
- Get SMTP + numeric OTP template sorted in Supabase (§2.3) — kick this off first thing since it may involve waiting on third-party account verification.
- Style `login/page.tsx` and `verify-otp/page.tsx` (currently unstyled TODO stubs) using the established Tailwind pattern from `staff-dashboard.tsx` / `admin/page.tsx` (rounded-xl border, `dark:` variants) — don't wait on the Figma port for this, it's two small forms.

**Day 2 — HR dashboard (the actual missing pipeline link)**
- Build `hr/page.tsx` UI against the already-implemented `getPendingHRRequests()` / `hrReviewRequest()`. Mirror the structure of `md-dashboard.tsx` (it's the closest analog: queue + review screen + approve/reject with reason).
- Must include per PRD 3.2: "Suggest Standard Rates" button, live total, overlap flag, resubmission context (prior rejection reason shown when `previous_version_id` is set).
- End-to-end smoke test: staff submits → HR reviews/forwards → MD approves. This is the one path that has never run start-to-end yet.

**Day 3 — UI convergence + hardening — ✅ Done 2026-08-18**
- ✅ Ported `Button`/`Input`/`Select`/`Card`/`StatusBadge` into `src/components/ui/`, deduped the 3 copy-pasted local `StatusBadge`s (staff/hr/md dashboards) into the shared one, retrofit login/verify-otp/Sign-Out buttons to use it. `frontend/` (including the stale `requeststatus.ts` enum) is deleted — one design system now.
- ✅ Added `loading.tsx` (skeleton) + `error.tsx` (using Next 16.2's `unstable_retry`) for all four dashboard routes (`staff`/`hr`/`md`/`admin`).
- ✅ Built the missing **Admin Staff Management UI** (`src/components/admin/staff-management.tsx`): staff table, Add Staff form, Deactivate action, wired to the already-implemented `staff.actions.ts`. `admin/page.tsx` was previously a static TODO stub with no data fetching and no auth guard at all — both fixed. Level/Rate/Department sections are still placeholders (out of scope for this pass).
- ⬜ Re-check every RLS policy against real logins — still a manual walkthrough task, not done yet (needs seeded staff across roles; see §7.1).

**Day 4 — Test pass + fix loop**
- Seed realistic test data (a few staff per role, a few requests in each status) — `supabase/seed.sql` currently only has departments/levels/rates, no sample staff or requests.
- Walk all four roles through the full lifecycle manually (submit → reject → resubmit → approve; test the "Final" rejection lock; test overlap warning; test admin CRUD).
- Fix what breaks. Freeze scope — anything new goes on the Sprint 4/backlog list, not into this build.

---

## 4. Folding in the Intern's Figma-Derived UI

Don't do a full retrofit of the already-working dashboards under deadline pressure — that's how you introduce regressions in code that currently works. Instead:
1. Treat `frontend/components/ui/*` as the **visual reference** (spacing, component shapes) for anything not yet built (HR dashboard, login/verify-otp styling).
2. Move the components you're actually going to use into `src/components/ui/` (not `frontend/`, which isn't part of the app's build), converting to named exports and adding `dark:` variants to match the rest of the app (nothing else in `src/` has a light-only design).
3. Replace `frontend/constants/requeststatus.ts` usage with the existing `REQUEST_STATUS_COLORS`/`REQUEST_STATUS_LABELS` in `src/lib/utils/constants.ts` — that's the one with the correct 6-state enum.
4. Delete or archive the standalone `frontend/` folder once its useful pieces are ported, so there's one design system, not two.

---

## 5. What Else You're Missing

- **Staging vs. production Supabase project.** `.env.local` is already configured against *a* project — confirm it's not the same project real staff will eventually use. Testing should not run against prod data/auth.
- **`auth_audit_log` is currently dead code** even after §2.2 — nobody reads it. Fine to leave read-only for v1, but worth a one-line admin view before you call auth "done," since it's explicitly a PRD security requirement, not a nice-to-have.
- **Realistic seed data.** Current seed only covers config tables — zero staff rows exist. This is a real chicken-and-egg problem for solo testing: `sendOtp`/`addStaff` both require a `public.staff` row, but creating one via the app requires already being logged in as admin. Bootstrap your first admin once via SQL Editor:
  ```sql
  insert into public.staff (id, email, first_name, surname, role, active)
  select id, email, 'Admin', 'User', 'admin', true
  from auth.users where email = 'YOUR_EMAIL_HERE'
  on conflict (id) do update set role = 'admin', active = true;
  ```
  (create the `auth.users` row first via Dashboard → Authentication → Users if it doesn't exist yet). After that, use the Admin dashboard's Add Staff form for everyone else. Still want: seeded staff across all 4 roles + a few travel requests pre-loaded in different statuses, so testers aren't starting from a completely empty system.
- **Session timeout enforcement.** PRD 2.1 specifies 8-hour inactivity expiry; nothing in `proxy.ts` currently enforces this — Supabase's default JWT expiry may not match. Worth an explicit check before testers leave a tab open overnight.
- **Mobile/responsive pass.** Staff submitting travel requests plausibly do it from a phone. Nothing in the plan above budgets time for this — worth at least a phone-width smoke test on the request form and login pages.
- **A rollback plan for the auth branch mess.** Whoever owns `feature/auth-otp-users` needs to know their branch is stale *before* they open a PR expecting a clean merge — tell them today, not after they've done more work on top of it.
- **CI won't catch RLS/business-logic bugs.** `.github/workflows/ci.yml` only runs lint + build with placeholder env vars — it can't catch a broken policy or a wrong query. Your Day 4 manual walkthrough is the only thing that will.

---

## 6. Open Decisions (need your call, not mine)

- Auth branch: rebase-and-continue with current owner, or take it over now given the clock?
- SMTP provider: do you already have one, or does this need signing up today?
- Is there a second Supabase project for staging, or are we testing against the one currently in `.env.local`?
