# Revised Scope — NIGCOMSAT Travel Platform

**Supersedes:** the pricing model in `IMPLEMENTATION_PLAN.md`, `notes.md` §5, `TRAVEL_POLICY_DEMO.md`
**Inputs:** `todays-task.md` (new brief) + your answers in `SCOPE_CHANGE_REVIEW.md` + two rounds of follow-up corrections
**Date:** 2026-09-10 (rev 3)
**Status:** scope only — no code written, no migration run

**Changed in rev 3:** band mapping confirmed, **Assistant Officer I added to the ladder** · airport taxi is **per traveller even on a shared trip** · road fare is a **flat ₦50,000/leg default** · one-way travel **halves the journey components** · ERP credential decision accepted as-is · multi-leg **deferred, not cancelled** · **new §9: hosting moves to a government cloud provider**

---

## 1. What we are building, in one paragraph

A **Naira-denominated domestic travel-cost calculator** that sits between NIGCOMSAT's Microsoft Dynamics ERP and the people who use it. A staff member signs in, enters a memo number that the ERP has already generated and the HOD has already approved, gives the trip details and who is travelling, and the platform prices the trip against the travel policy automatically. HR reviews that number — adjusting only days allowed, transport cost, and airport taxi — and submits. The submission pushes a costed memo back into Dynamics for the MD to approve there. The platform never owns the approval; it owns the arithmetic, the audit trail, and the policy.

The single most important structural rule, unchanged across all three revisions: **the calculator ships before the ERP integration, and nothing in the calculator depends on it.**

---

## 2. Decisions now locked

| # | Decision | Consequence |
|---|---|---|
| 1 | **Coverage applies to DTA and local running only.** Airfare, road fare and airport taxi are paid at full cost | Calculator scales two line items, never four |
| 2 | **Coverage is destination-driven.** Lagos / Abuja / Port Harcourt = 100%; everywhere else = 75% | Grade determines the *amount*; destination determines the *percentage* |
| 3 | **DTA and local running are both per day** | `days = (return − depart) + 1`, inclusive. A same-day trip is 1 day |
| 4 | **DTA absorbs accommodation.** Staff sort their own lodging out of DTA | `travel_requests.accommodation` is deleted, not repurposed |
| 5 | **The memo is already HOD-approved** before it reaches this platform | No HOD gate, no HOD role, no status for it |
| 6 | **One memo can carry several travellers**, raised by the most senior staff member on the trip | Requires a travellers child table — see §6.3 |
| 7 | **Each traveller is priced at their own band** | An Officer I travelling with the GM is not paid at GM rate |
| 8 | **Air = ₦150,000 each way flat**, ₦300,000 round trip. No per-route table — HR reports fares have hardly ever exceeded it, and raises the figure in the rare case they do | Deletes a table and an Admin screen |
| 9 | **Road = ₦50,000 each way flat**, ₦100,000 round trip, same treatment as air. HR retains liberty to change it | Resolves the `50,0000` typo *and* the "calculated based on destination" wording |
| 10 | **Airport taxi = ₦80,000 flat**, any city, **and every traveller gets their own** — a shared car does not reduce anyone's entitlement | Per-traveller line, not a trip-level cost |
| 11 | **Airport taxi on road trips = ₦0**, enforced by the calculator | Cannot be entered by hand either |
| 12 | **One-way travel halves the journey components** — transport and airport taxi | See §4.2 for the one qualifier |
| 13 | **14 designations replace the 8 demo levels entirely**, mapped to 4 rate bands | Old `levels` rows are dropped, not migrated |
| 14 | **Explicit `grade_bands` table** | Rates are data, editable by Admin, not constants in code |
| 15 | **NGN throughout.** No FX, no USD, anywhere | Kills the ₦90,000,000 mispricing bug in §3 of the review |
| 16 | **No international travel**, and no plan to bring it back | International `rate_reference` rows and `route_type` splits are deleted |
| 17 | **ERP is Microsoft Dynamics** | Integration approach in §8 |
| 18 | **MD outcome comes back by polling the ERP** | Not a webhook; needs read credentials |
| 19 | **One HR account holds the ERP credentials** — one person handles this work | Accepted as specified; safeguards in §8.4 |
| 20 | **Money is a reimbursement**, not an advance | **No retirement/reconciliation phase. Whole workstream deleted.** |
| 21 | **The on-prem login request was about OTP being painful** | Entra ID SSO answers it — see §7, subject to §9.3 |
| 22 | **Multi-leg trips deferred**, not permanently excluded | Data model should not actively prevent them later |
| 23 | **Hosting moves to a government-owned cloud provider** | New section §9 — the largest open item in this revision |

---

## 3. The grade ladder and rate bands

Confirmed by you, with **Assistant Officer I** added to the ladder since rev 2. Fourteen designations, four bands, no orphans.

| Band | Designations | DTA/day @100% | DTA/day @75% | Local running/day @100% | @75% |
|---|---|---|---|---|---|
| **B1** | Managing Director · Executive Director | ₦60,000 | ₦45,000 | ₦18,000 | ₦13,500 |
| **B2** | General Manager · Deputy General Manager · Assistant General Manager | ₦40,000 | ₦30,000 | ₦12,000 | ₦9,000 |
| **B3** | Senior Manager · Manager · Deputy Manager · Assistant Manager | ₦30,000 | ₦22,500 | ₦9,000 | ₦6,750 |
| **B4** | Senior Officer · Senior Technical Officer · Officer I · Officer II · **Assistant Officer I** | ₦15,000 | ₦11,250 | ₦4,500 | ₦3,375 |

**Only the 100% column is stored.** The 75% figures are derived from a coverage tier held as data (`coverage_tiers`), so a change to the discount rate — or a fourth 100% city — is a row edit, not a deploy. Every 75% value divides exactly; no rounding rule needed.

**Watch out when reading test output:** B2 at 75% and B3 at 100% produce *identical* figures (₦30,000 DTA, ₦9,000 local running). A genuine property of the policy, not a bug. The suite asserts both explicitly so nobody "fixes" it later.

**Mapping is exhaustive with hard failure.** A designation that maps to no band must cause the calculation to **refuse and route to HR** — never silently fall back to B4 or to zero. This matters more now than it did: "Assistant Officer I" was not in the original ladder, and a fourteenth grade appearing once means a fifteenth can appear again. The failure mode must be a visible refusal, not a quiet default. **See question 1 in §11** — the naming pattern suggests an Assistant Officer II may also exist.

---

## 4. The calculator — exact specification

One pure function, `src/lib/policy/calculate.ts`, consumed by the staff form preview, the server-side insert, and HR's live recalculation. No second implementation anywhere.

It prices **one traveller**. A memo with several travellers calls it once per traveller and sums — which is what keeps the multi-traveller case from becoming a second code path.

```
coverage   = destination ∈ {Lagos, Abuja, Port Harcourt} ? 1.00 : 0.75
days       = days_approved ?? days_requested          // HR override wins
                                                      // days_requested = (return − depart) + 1
legs       = one_way ? 1 : 2

dta        = band.dta_per_day           × coverage × days
local      = band.local_running_per_day × coverage × days
transport  = (mode == 'air' ? 150_000 : 50_000) × legs     // NOT scaled by coverage
taxi       = mode == 'air' ? 40_000 × legs : 0             // NOT scaled by coverage

traveller  = dta + local + transport + taxi
request    = Σ traveller
```

`transport` and `taxi` resolve as **HR override → policy default**. There is no route lookup layer (decisions 8 and 9).

Because DTA is per day and the count is inclusive, **a same-day return trip is 1 day and earns a full day's DTA and local running.** The zero-allowance edge case a per-night model created no longer exists.

### 4.1 Worked examples — these become the first test cases

| Case | Band | Route | Mode | Days | Cov. | DTA | Local | Transport | Taxi | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | B3 | Abuja → Kano | air | 3 | 75% | 67,500 | 20,250 | 300,000 | 80,000 | **₦467,500** |
| 2 | B2 | Gombe → Lagos | air | 2 | 100% | 80,000 | 24,000 | 300,000 | 80,000 | **₦484,000** |
| 3 | B4 | Kaduna → Kano | road | 4 | 75% | 45,000 | 13,500 | 100,000 | 0 | **₦158,500** |
| 4 | B1 | Abuja → Port Harcourt | air | 1 | 100% | 60,000 | 18,000 | 300,000 | 80,000 | **₦458,000** |
| 5 | B3 | Lagos → Gombe | road | 3 | 75% | 67,500 | 20,250 | 100,000 | 0 | **₦187,750** |
| 6 | B3 | Abuja → Kano | air, **one-way** | 3 | 75% | 67,500 | 20,250 | 150,000 | 40,000 | **₦277,750** |

Case 4 is the counter-intuitive one worth showing HR: an **Abuja-based MD travelling to Port Harcourt is on 100%**, while a **Port Harcourt-based officer travelling to Gombe is on 75%**. The allowance tracks the cost of the place you are *in*. Intended — and the UI states which tier applied and why on every request.

Multi-traveller — one memo raised by a GM, Abuja → Kano, air, 3 days, 75%:

| Traveller | Band | DTA | Local | Transport | Taxi | Subtotal |
|---|---|---|---|---|---|---|
| General Manager *(requester)* | B2 | 90,000 | 27,000 | 300,000 | 80,000 | ₦497,000 |
| Assistant Manager | B3 | 67,500 | 20,250 | 300,000 | 80,000 | ₦467,500 |
| Officer I | B4 | 33,750 | 10,125 | 300,000 | 80,000 | ₦423,875 |
| | | | | | **Memo total** | **₦1,388,375** |

Three separate ₦80,000 taxi lines, per decision 10 — even if all three share one car.

### 4.2 One-way — the one qualifier

You said halve everything. I have applied that to **transport and airport taxi**, which are the components priced per journey.

**DTA and local running are left on the day count.** They are per-day living costs, not journey costs — a one-way traveller who spends three days in Kano eats and moves around for three days exactly as a return traveller does. Halving them would pay two people in the same city on the same days different living allowances because one of them is flying home. If HR does intend the literal reading, it is a one-line change to the calculator and one extra test case — but it should be a deliberate policy statement, not something the code assumes. **Question 2 in §11.**

### 4.3 Server authority

The client may preview. **The amount persisted is always recomputed server-side** from each traveller's designation and the trip parameters. A client-supplied figure never reaches the database. `requests.actions.ts` already owns every write — a constraint to preserve, not build.

### 4.4 Rate snapshotting

At submit, the request stores a `policy_snapshot` JSONB: band code, both per-day rates, coverage tier and percent, and the transport/taxi defaults in force. If Admin edits a band rate next Tuesday, every request already in HR's queue keeps the number the staff member saw. Without it, a rate change silently rewrites history.

### 4.5 Tests come first

There is **no test runner in `package.json` today**. Add Vitest, and write a table-driven suite over every (band × coverage × mode × days × one-way) combination, plus the multi-traveller sum, **before** the calculator exists. Once the calculator is the entire value proposition, this is the cheapest insurance available.

---

## 5. What survives untouched

Auth shell and session handling · RLS pattern and `current_staff_role()` · route protection (`src/proxy.ts` + `ROUTE_ACCESS`, which correctly 404s a wrong-role visit) · request versioning (`travel_group_id` / `previous_version_id`) · `rate_overrides` · the UI component library · `airports` · the overlap warning · dashboard layouts and navigation.

That is most of the application. The rebuild is the pricing core, not the product.

---

## 6. Data model changes

### 6.1 `M1 — grade bands and the new ladder`
- `CREATE TABLE grade_bands` — code, name, `dta_per_day`, `local_running_per_day`, sort order
- `CREATE TABLE coverage_tiers` — `full` (100), `partial` (75)
- `CREATE TABLE destination_coverage` — city → tier; Lagos, Abuja, Port Harcourt seeded as `full`, everything else defaulting to `partial`
- Rebuild `levels`: **drop `coverage_percent`** (wrong in value *and* meaning now), drop `flight_class` (no international, no class distinction), add `band_id NOT NULL`, add `sort_order`. Replace the 8 demo rows with your 14 designations
- Remap `staff.level_id`. Current rows are demo seed, so this is a clean replace — **confirm no real staff data exists in the target database before running it**

### 6.2 `M2 — currency: NGN only`
- Drop `travel_requests.locked_fx_rate`; delete `fx_rate_usd_ngn` from `app_settings`; retire `FX_RATE_SETTING_KEY`
- Delete all international `rate_reference` rows; drop its `route_type` column
- Delete `usdToNgn`, `ngnToUsd`, `formatUSD` from `src/lib/utils/formatting.ts`; simplify `<Money>` to NGN-only
- Remove the Admin FX override UI and `getFxRateOverride` / `setFxRateOverride`

**This migration closes the live bug.** Today, HR typing `60000` meaning ₦60,000 into a USD column reports **₦90,000,000** with no warning. Nothing else ships before this.

### 6.3 `M3 — request schema and travellers`

The request splits into a **trip header** and **one row per traveller** — the shape decision 6 forces, and the shape the ERP write-back wants anyway (one memo, N cost lines).

`travel_requests` (one row per memo): ADD `memo_number`, `requested_by_staff_id`, `days_requested`, `days_approved`, `one_way BOOLEAN`, `policy_snapshot JSONB`, `coverage_percent_applied`, `request_total`. DROP `accommodation`, `days`, and all five allowance columns plus `total_cost`/`final_cost` — **those move to the traveller row**. ALTER `status` → `pending_hr`, `hr_returned`, `queued_for_erp`, `in_erp`, `approved`, `rejected`, `rejected_final`.

`request_travellers` (new): `request_id` · `staff_id` · `grade_band_code` (snapshot) · `dta` · `local_running` · `transport_cost` · `airport_taxi` · `traveller_total` · `UNIQUE(request_id, staff_id)`.

`staff_id` is a real FK, not a typed name — that is what makes each traveller's band lookup automatic and stops an Officer I being priced as a Manager because someone typed the wrong grade.

**Memo-number uniqueness** is a partial index over live statuses only, so a returned request can be resubmitted under the same memo but two live requests cannot coexist:

```sql
CREATE UNIQUE INDEX ON travel_requests (memo_number)
  WHERE status IN ('pending_hr','queued_for_erp','in_erp','approved');
```

Also enforced at validation: **destination ≠ origin**, origin restricted to the four duty stations, **at least one traveller**.

**Leave room for multi-leg** (decision 22). Keeping origin/destination on the trip header rather than inventing a leg table now is correct — but do not add a constraint that makes a future `request_legs` table impossible.

### 6.4 `M4 — policy defaults`

Three rows in `app_settings`: air ₦150,000/leg, road ₦50,000/leg, taxi ₦40,000/leg. Admin edits them; HR overrides per request. **The per-route fare table from rev 1 is dropped** — decisions 8 and 9.

Origins are already seeded: **Abuja (ABV), Lagos (LOS), Kaduna (KAD), Gombe (GMO)** and Port Harcourt (PHC) all exist in `airports` from `20260822160000_airports.sql`. **No airport migration needed.**

`rate_reference` survives only as the HR flight-price reference board; it is no longer a pricing input.

### 6.5 `M5 — ERP outbox` *(Phase 3)*
`erp_outbox` — request id, **idempotency key (unique)**, payload, state, attempts, last error, next attempt at. `travel_requests` gains `erp_memo_id`, `erp_state`, `erp_last_polled_at`, `md_decision`, `md_decision_at`, `md_decision_reason`.

### 6.6 `M6 — RLS`
- MD update policies narrow to **read-only**; `mdApproveReject` retires
- `approvals` is **kept and repurposed** — it records the ERP-reported MD outcome rather than being where the decision is made. Deleting it would throw away the only structure capable of holding the answer that has to come back
- HR gains write access to the three editable fields only; DTA and local running are not HR-writable
- **New:** a traveller who is not the requester must see the request they are on. `Staff select own requests` currently keys on `staff_id`; it must key on requester **or** membership in `request_travellers`

---

## 7. Application changes by surface

**Staff.** Step 1 is the memo number, format-validated (Phase 2 looks it up in Dynamics and auto-fills). Name and designation come from the session, read-only. Travellers: the requester is added automatically; a picker adds colleagues from `staff`, each showing their designation. Most requests are one person, so the section stays collapsed. Origin is a dropdown of the four duty stations; destination is the airports dropdown plus a free-text hatch for road-only places. A one-way toggle. Dates → days computed and shown ("3 days, 15–17 Sep"). **Live cost preview**, broken down per traveller, with a plain-English note: *"Kano is not Lagos, Abuja or Port Harcourt, so DTA and local running are at 75%."*

**HR.** The queue shows a **computed total** on arrival, not empty fields to fill — this is the change that removes the work. The review screen edits exactly three things: **days allowed, transport cost, airport taxi**; DTA and local running recompute live and are otherwise locked as policy. On a multi-traveller memo, days apply to the trip while transport and taxi are per traveller (someone may drive while the rest fly). `rate_overrides` logs every deviation — the evidence trail for why someone was paid above policy, an audit requirement for a parastatal. Submit commits locally and enqueues the ERP push, never a synchronous call. **Sync state** is visible per request: `queued` / `pushed` / `failed` / `entered manually`. **Printable memo + copy-to-clipboard breakdown** is the Phase 0 deliverable and stays permanently as the fallback. Keep the flight-price lookup — with a flat ₦150,000 default, a live fare check is exactly the evidence needed to justify raising it.

**MD.** Approve/reject removed; `mdApproveReject` retired. The **read-only view stays** behind the existing `md` role: the ERP memo carries a total, not the per-traveller breakdown, coverage rationale, or HR's note. When the MD asks *"why is this ₦1,388,375?"*, this answers it for free. Deleting the dashboard later is cheap; rebuilding it under pressure after launch is not.

**Admin.** New: grade-band rates, coverage-tier city list, policy defaults, designation→band mapping. Removed: FX override, level coverage percentages, international rates. Not built: the route-fare editor from rev 1.

---

## 8. ERP integration — Microsoft Dynamics

**8.1 Still needed:** which Dynamics, and where it runs. Business Central, Finance & Operations, and Dataverse/CE have three different APIs, three auth models, three answers on webhooks; cloud and on-prem differ again. A question for NIGCOMSAT ICT, not an engineering decision. **Does not block Phase 0.**

**8.2 Read and write are different problems.** Reading a memo is idempotent, cannot corrupt anything, and degrades to manual entry. Build the manual path first and treat lookup as an enhancement. Writing into another system's approval workflow is the hard part, and must never happen synchronously from the submit button: ERP slow → HR clicks twice → two memos; ERP down → twenty minutes of pricing lost to an error toast; timeout after the ERP committed → platform thinks it failed, HR retries, MD gets a duplicate.

**8.3 The outbox pattern.** HR's submit commits locally in one transaction and enqueues a job; a background worker drains the queue. Four things, none optional: an **idempotency key** (memo number + request version) so a retry can never create a second memo; **visible sync state**; **manual retry plus an explicit "I entered this in the ERP by hand" escape hatch**; and a **dead-letter view** so failures surface instead of retrying forever. Categorically: **no direct writes to Dynamics tables** — they carry number sequences, state machines and approval-routing rows, and rows inserted behind the application's back produce memos the MD cannot action.

**8.4 Credentials — decided.** One HR person's ERP account, because one HR person handles this work. Taken as settled. Two safeguards that cost almost nothing and prevent the known failure mode: **an authentication health check that alarms loudly when the credential stops working** — otherwise a password change silently piles every submission up in the outbox — and **a written rotation runbook** so updating it is a config change, not an incident. Memos will be attributed to that person in Dynamics, which is probably what the MD expects anyway.

**8.5 Closing the loop — polling.** A scheduled job re-reads memo status for every request in `in_erp` and records `approved`/`rejected` into `approvals` and the request status. Staff then see the outcome of their own request here, which they otherwise never would. **The manual fallback must exist regardless** — it is the only option that works when the integration is down, and retrofitting outcome tracking after launch means backfilling by hand.

---

## 9. Hosting — the government cloud move

This is new in rev 3 and it is the largest open item. It does not block Phase 0, but it must be **decided before launch, not after** — while it is a deployment choice rather than a migration.

### 9.1 The good news: the stack self-hosts cleanly

**Next.js 16 is genuinely portable.** Per the self-hosting guide in `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`: `next start` behind an nginx reverse proxy is the recommended shape; **image optimization works with zero configuration**; **`src/proxy.ts` works with zero configuration** — which matters, because route protection lives there. A single instance with persistent local disk needs no custom cache handler. Docker via `output: 'standalone'` is supported if the provider wants containers.

**Background workers get easier, not harder.** The ERP outbox worker and the MD status poller are long-running processes — awkward on serverless, natural on a VM you control.

**ERP connectivity probably improves.** If Dynamics is on-prem or already government-hosted, reaching it from a government cloud is likely far simpler than reaching it from Vercel. This may be the single biggest technical benefit of the move.

### 9.2 The database is the decision that matters

**Recommendation: self-hosted Supabase, not plain Postgres.** The entire security model of this application is RLS plus `auth.uid()` plus `current_staff_role()` — every policy in `20260731144738_initial_schema.sql` is built on it. Self-hosted Supabase (Postgres + Auth + PostgREST + Storage behind Kong) preserves all of it: same migrations, same policies, same client libraries, no application rewrite. Dropping to plain Postgres with a bespoke auth layer would mean rewriting the part of the system it is least safe to rewrite, and would deliver nothing the managed components do not already do.

### 9.3 The question that decides the login story

**Does the government cloud permit outbound internet from the application servers?**

- **Yes** → Entra ID SSO (§2, decision 21) works exactly as designed. It needs outbound HTTPS to `login.microsoftonline.com`, nothing more, and is entirely independent of where the app is hosted.
- **No** → Entra SSO is impossible, and so is emailed OTP unless there is an internal SMTP relay. The fallback would be a self-hosted identity provider inside the same network. That is a materially different and larger workstream.

This one answer changes the auth plan more than anything else in this document. **It should be asked at the same time as the provider question, not after.**

Outbound access also gates the flight-price lookup, which calls an external API.

### 9.4 What the move actually costs

Managed hosting is doing real work today that somebody must pick up: TLS certificates and renewal · **backups and tested restores** · OS and Postgres patching · monitoring and alerting · secrets management · a CI/CD path into that environment · and somebody reachable when it breaks at month-end while HR is trying to process travel. This needs a **named owner in NIGCOMSAT ICT**, agreed before launch. It is not a large engineering task; it is a standing operational commitment, and projects usually discover that too late.

### 9.5 The one thing to do immediately

**Adopt no Vercel-only feature from today onward.** No edge runtime assumptions, no platform-specific cron, no Vercel KV or Blob, no `@vercel/*` imports. This costs nothing now and is the difference between a deployment and a port. The current codebase is already clean on this — keeping it that way is the whole job.

Development continues against local or managed Supabase and moves to the government cloud when the environment exists.

---

## 10. Build order

| Phase | Contents | Depends on |
|---|---|---|
| **0a** | **Currency: NGN only** (M2). Kills the live mispricing bug | Nothing |
| **0b** | Grade bands, coverage tiers, 14-designation ladder (M1) | 0a |
| **0c** | **Vitest + the test suite from §4.1, written first**, then `calculate.ts` | 0b |
| **0d** | Request schema + travellers table (M3), memo entry, staff auto-calculation, HR three-field review, rate snapshotting | 0c |
| **0e** | Policy defaults (M4) + Admin editors | 0b |
| **0f** | **Printable memo + copy-ready breakdown.** MD dashboard to read-only (M6) | 0d |
| **1** | **Entra ID SSO** — parallel with any of the above | §11 Q4 |
| **2** | **Hosting**: provision, self-hosted Supabase, nginx + `next start`, backups, CI/CD | §11 Q3, Q4 |
| **3** | ERP **read**: memo lookup auto-fills the form, fails soft to manual | §11 Q5 |
| **4** | ERP **write**: outbox, idempotency, sync status, manual override (M5) | §11 Q5 |
| **5** | **Outcome polling**: MD decision back into `approvals` | 4 |

**Phase 0 is a complete, usable product** — it eliminates 100% of the arithmetic and the entire class of grade-band lookup errors, with zero dependency on anything outside our control. HR pastes a finished breakdown into Dynamics: roughly ninety seconds of clerical work per request, against the twenty minutes of calculation the platform removes.

To be straight about the pushback in the brief — *"it will be defeated if after this platform does all the calculations, the HR still has to go to the ERP and create a memo."* That overstates it. The labour HR is drowning in is the calculation, not the paste. The write-back is worth building, and Phase 4 builds it. It is not worth **blocking the entire platform** on while a vendor question and a hosting decision sit unanswered.

---

## 11. Open questions

None block Phase 0. Ordered by how much they change.

1. **Is there an Assistant Officer II, or any other grade not yet listed?** "Assistant Officer I" surfaced only in the last round, and the Officer I / Officer II pattern suggests a sibling. Cheap to ask, and an unmapped grade must refuse to calculate rather than guess.
2. **One-way: confirm DTA and local running are *not* halved** (§4.2). Journey components are halved; per-day living costs are not. Say so explicitly in the policy.
3. **Which government cloud provider, and what does it offer** — bare VMs, Kubernetes, managed Postgres? (§9)
4. **Does that environment permit outbound internet?** Gates Entra SSO, email, and the flight-price lookup. **The highest-leverage question in this document.** (§9.3)
5. **Which Dynamics product, version, and deployment model?** For ICT. Gates Phase 3 onward. (§8.1)
6. **Who owns the infrastructure and on-call after launch?** (§9.4)
7. **Are DTA and local running paid on both travel days?** The inclusive count assumes yes — depart Monday, return Wednesday is 3 days. Worth writing into the policy rather than leaving as a property of the code; it is ₦15,000–₦60,000 per trip depending on band.

---

## 12. Out of scope

International travel (ministry-funded) · accommodation as a separate reimbursable · **retirement/reconciliation** (reimbursement model) · **per-route fare tables** · HOD approval workflow (happens in the ERP) · MD approve/reject in this app · budget ceilings · AI rate suggestions · USD and FX handling of any kind.

**Deferred, not cancelled:** multi-leg trips (decision 22) and mixed-mode travel for a single traveller — though on a multi-traveller memo, different people can already be on different modes.

---

## 13. Notes for whoever implements this

- This project runs **Next.js 16.2.12**, which is not the Next.js in anyone's training data. `AGENTS.md` is not decorative: **read the relevant guide in `node_modules/next/dist/docs/` before writing code.** Route protection already uses `src/proxy.ts`, Next 16's replacement for middleware, and per the self-hosting guide it works unchanged off-Vercel
- `zod@4` — not v3. The `.refine` and error-shape APIs differ
- The calculator is a **pure function with no Supabase import**, and it prices **one traveller**. That is what makes the test suite possible, what keeps the multi-traveller case from becoming a second code path, and what stops the logic drifting between the preview and the saved figure. A preview that disagrees with the stored total destroys trust in the platform faster than anything else it could do wrong
