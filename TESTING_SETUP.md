# Internal Testing Setup

**Goal:** get you + 5 interns onto the platform this week — 5 as `staff`, one person as `hr`, one as `md` — before real staff start testing next week.

## 1. Before you seed anyone

- Confirm `.env.local` points at a **dev/test Supabase project**, not one real staff will eventually use (`IMPLEMENTATION_PLAN.md` §5 flags this).
- Confirm the migrations are applied, including `20260820130000_demo_travel_policy.sql` (levels + rate reference — needed because every account below gets assigned a level, and the level names below have to already exist).
- Confirm SMTP is configured in the Supabase dashboard (`IMPLEMENTATION_PLAN.md` §2.3) — without it, OTP emails won't arrive for real testers. This blocks real usage, not the seeding step itself.

## 2. The roster

Placeholder emails for now (per your call — swap for real addresses before anyone actually tries to log in):

| Name | Email | Role | Department | Level |
|---|---|---|---|---|
| Intern One | `bashironimison@gmail.com` | staff | Engineering | Junior Staff |
| Test Staff | `unnazitere@gmail.com` | staff | Engineering | Junior Staff |
| Test HR | `borisrael.ng@gmail.com` | hr | Human Resources | Manager |
| Test MD | `cpdokoye7@gmail.com` | md | Management | Executive Director |
| HR Backup | `godblessbashir@gmail.com` | hr | Human Resources | Manager |

You (as the person who bootstraps the first admin, see §3) can also just be one of the interns' roles, or add yourself as an 8th row — whatever matches how you actually want to divide the 5 interns + yourself.

## 3. You need one admin account first

Nobody can use the Admin "Add Staff" form without already being logged in as `admin`, and nobody can become `admin` through the app itself (chicken-and-egg, by design — PRD §3.4). Bootstrap the first one via the Supabase SQL Editor, once:

1. Dashboard → Authentication → Users → create a user with your real email (or use the SQL below if the `auth.users` row already exists from a prior sign-in attempt).
2. SQL Editor:
   ```sql
   insert into public.staff (id, email, first_name, surname, role, active)
   select id, email, 'Admin', 'User', 'admin', true
   from auth.users where email = 'YOUR_EMAIL_HERE'
   on conflict (id) do update set role = 'admin', active = true;
   ```

## 4. Add the roster — two ways, pick one

**Option A — through the app (no setup, a bit of clicking):** log in as admin → Admin dashboard → Staff Management → "+ Add Staff", once per person in the table above. This is the same code path as Option B, just one row at a time through the UI.

**Option B — the seed script (all 7 at once):**
```bash
node --env-file=.env.local scripts/seed-test-accounts.mjs
```
Edit the `ROSTER` array at the top of `scripts/seed-test-accounts.mjs` first — swap in real emails (and adjust names/departments/levels) before running. It's idempotent: re-running skips anyone who already has a staff row, so it's safe to run again after fixing an email.

Either way, the login mechanism is the same for everyone — OTP to their email (PRD §2.1). No separate "test mode" login.

## 5. Suggested test pass, once the roster is in

1. As a staff tester: submit a request, confirm the pre-submit estimate and overlap warning behave, resubmit after a rejection.
2. As HR: forward one request, reject one (with and without "Final"), use "Suggest Standard Rates" on a request whose destination has a seeded rate, check the Flight Price Reference panel shows sensible numbers.
3. As MD: approve one, reject one as Final and confirm the staff side shows it as non-resubmittable.
4. As Admin: deactivate one of the 5 test staff, confirm they can no longer request a login OTP; edit a level's coverage % and confirm it changes the live total on a fresh request.

Full Reporting & Audit isn't built yet (deferred, see `UI_UX_DESIGN_PLAN.md` §4/§6) — don't block this week's pass on it.
