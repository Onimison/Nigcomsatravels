# Scope Change Review — `todays-task.md`

**Reviewer:** engineering review, no code changed
**Date:** 2026-09-08
**Status:** review only — nothing implemented, nothing migrated

---

## 0. Read this part first

Three things before the detail.

**1. The file is truncated.** `todays-task.md` ends mid-word:

> `One ma`

There is at least one more requirement I have not seen. Please send it before anything gets scheduled.

**2. This is not a change request, it is a different product.** The build so far models *"HR prices a trip in USD, applies a per-grade coverage percentage to the whole bill, and an MD approves it in this app."* The new brief is *"the ERP owns the memo and the approval, this platform is a policy calculator that reads from and writes back to the ERP, in Naira, with coverage driven by destination."* Almost every load-bearing assumption in the data model flips. That is fine and the direction is right — but it should be planned and estimated as a rebuild of the pricing core, not as a set of tweaks. The UI, auth shell, RLS pattern, request lifecycle, and airports table survive; the cost engine, the currency model, and the level model do not.

**3. There is one live mispricing bug the moment anyone types a Naira figure into the current build.** See §3. It is the single most urgent item in this document.

---

## 1. Blocking ambiguities — I cannot build the calculator without these answers

These are not nitpicks. Each one produces a materially different number on the same trip, and staff will notice the difference in their bank account on day one.

### 1.1 What does the 75% actually apply to? (highest priority)

The brief says:

> "these are for locations where it is 100% covered, you will do the 75% calculations for the other locations and then the estimated cost will be an aggregation of all cost inputs by the staff on the form"

That sentence has three defensible readings. Worked example — **AM–SM grade, Abuja → Kano, air, 3 days** (Kano is not Lagos/Abuja/PH, so 75%):

| Reading | What gets the 75% | Total |
|---|---|---|
| **A** — coverage on allowances only | DTA + local running discounted; airfare, taxi at full cost | **₦467,500** |
| **B** — coverage on the whole aggregate | Everything including airfare and taxi × 0.75 | **₦372,750** |
| **C** — coverage on DTA only | Local running and transport at full cost | **₦474,500** |

Breakdown for A: DTA (30,000 × 0.75 × 3 = 67,500) + local running (9,000 × 0.75 × 3 = 20,250) + airfare (300,000) + airport taxi (80,000).

**A spread of ₦94,750 — about 20% — on a single routine trip.**

**My argument for Reading A.** DTA and local running are *allowances* — discretionary sums calibrated to cost of living, and a 25% haircut for a cheaper city is coherent. Airfare and airport taxi are *reimbursements of actual expenditure*. A ticket to Kano does not cost 25% less because Kano is not Lagos; if you pay 75% of the fare, the staff member funds the remaining quarter out of pocket, which is not a policy, it is a pay cut. The same logic voids Reading B for road transport. I would build A — but this needs a one-line written confirmation from HR, not my inference, because it is the number the whole platform exists to produce.

Note also that the coverage split is **destination-driven**, which is worth stating explicitly because it is counterintuitive: a Lagos-based officer travelling to Gombe gets 75%; a Gombe-based officer travelling to Lagos gets 100%. Same two cities, different rate, depending on direction. Confirm that is intended (I believe it is — the allowance tracks the cost of the place you are *in*).

### 1.2 Is DTA per day or per night?

A trip departing Monday and returning Wednesday is 3 days or 2 nights. At ₦22,500/day that is a ₦22,500 difference per trip, per person. The brief says "local runnings ... depends on the number of days" and never defines the day count. Related: are DTA and local running both paid on travel days? This must be written down in the policy, not decided by the code.

### 1.3 Does DTA absorb accommodation?

The current schema has `accommodation` and `per_diem` as separate first-class allowance columns (`travel_requests`, initial schema). The new policy names **DTA, local running, airfare/road, airport taxi** — and no accommodation line at all.

Either:
- **DTA is inclusive of accommodation** (the standard Nigerian public-service construction) — in which case `accommodation` must be removed, or HR will pay hotel costs *on top of* an allowance already meant to cover them; or
- **Accommodation is a separate reimbursable** that the brief simply omits.

I lean strongly to the first, but if I guess wrong the platform silently overpays every single trip. Confirm.

### 1.4 One memo = one traveller?

ERP travel memos frequently cover several staff on the same trip. If one memo number can carry three travellers, then:
- the memo number is not a unique key for a request,
- each traveller needs their own grade-based calculation under one memo,
- the ERP write-back has to post one memo with N cost lines, not N memos.

This changes the data model, not just a field. It is the cheapest question on this list to ask and the most expensive one to get wrong.

### 1.5 Advance or reimbursement?

Is the approved sum paid *before* travel (an advance, requiring a post-trip retirement/reconciliation step) or claimed *after*? The platform currently ends at approval. If there is a retirement step, that is a whole additional phase nobody has scoped.

### 1.6 Where does the HOD sit in the new flow?

Current ERP flow is Staff → HOD → HR → MD. The new flow starts with the staff entering a memo number. **Is that memo already HOD-approved at that point, or not?** If staff can enter a memo the HOD has not yet cleared, HR will spend time pricing trips that get killed upstream, and the platform will hold approved costings for trips that never happen. If the ERP read API can return memo status, gate on it. If there is no API, HR needs a visible "HOD approved? ✓" checkbox they tick manually before pricing.

### 1.7 Typos and small confirmations

- **`50,0000`** for road trips — ₦50,000 or ₦500,000? I assume ₦50,000 each way (₦100,000 round trip), consistent with the surrounding figures.
- Airfare "150,000 to and another 150,000 fro" → **₦300,000 round trip default**. Confirm.
- Airport taxi ₦40,000 × 2 = **₦80,000**. Confirm this is a flat figure regardless of city.
- **Airport taxi on road trips should be ₦0.** Nothing in the current or proposed model prevents an ₦80,000 airport taxi being attached to a road journey. This must be a hard rule in the calculator, not HR's memory.

---

## 2. The travel policy vs. the existing data model

### 2.1 `levels.coverage_percent` is now wrong in both value and meaning

The current model puts `coverage_percent` on the **level** (grade) and multiplies the entire bill by it (`calculateFinalCost` in `src/lib/utils/formatting.ts`, applied in `hrReviewRequest`). The seeded demo values are 50% for Junior Staff up to 100% for Executive Director.

Under the new policy, coverage is a property of the **destination** (100% for Lagos/Abuja/Port Harcourt, 75% everywhere else) and grade determines the *base amount*, not the percentage. The column is not merely unused — if left in place with its demo values, a Junior Staff request gets silently halved. It has to be dropped or repurposed in the same change that introduces destination coverage. There is no safe intermediate state.

The original PRD note — *"the code is completely agnostic to policy direction, it just multiplies"* (`notes.md` §5.1) — was a good instinct that the new policy invalidates. Coverage now depends on the trip, not the person.

### 2.2 Grade bands do not map onto the current `levels` table

The policy has five bands:

| Band | DTA (100%) | DTA (75%) | Local running/day (100%) | (75%) |
|---|---|---|---|---|
| MD/CEO | 60,000 | 45,000 | 18,000 | 13,500 |
| Executive Directors | 60,000 | 45,000 | 18,000 | 13,500 |
| AGM – GM | 40,000 | 30,000 | 12,000 | 9,000 |
| AM – SM | 30,000 | 22,500 | 9,000 | 6,750 |
| Senior Officer – lowest | 15,000 | 11,250 | 4,500 | 3,375 |

The seeded `levels` rows are Junior Staff, Senior Staff, Assistant Manager, Manager, Deputy Director, Director, General Manager, Executive Director. **"Deputy Director" and "Director" appear in the table and in neither band.** "Manager" sits ambiguously between AM–SM and AGM–GM.

Recommendation: introduce an explicit `grade_bands` table holding the four distinct rate pairs, and a mapping from every real NIGCOMSAT grade string to exactly one band. The mapping must be **exhaustive with a hard failure** for anything unmapped — a request from an unmapped grade should refuse to calculate and route to HR, never fall back to a default. A silent default here means someone is paid at the wrong band and nobody finds out.

Get the authoritative grade ladder from HR or the ERP, not from the demo seed.

*(Observation, not a recommendation: local running is exactly 30% of DTA in every band. Do not encode that ratio — if it is coincidence, hardcoding it turns one policy change into a bug.)*

### 2.3 Allowance field mapping

| New policy line | Existing column | Note |
|---|---|---|
| DTA | `per_diem` | Rename; possibly absorbs `accommodation` (§1.3) |
| Local running | `allowance_local` | Direct fit |
| Airfare **or** road transport | `allowance_flight` | Two different things in one column; `mode` disambiguates but the audit trail loses clarity. Prefer a `transport_cost` + `transport_mode` pair |
| Airport taxi | `allowance_taxi` | Must be forced to ₦0 on road trips |
| — | `accommodation` | **Orphaned** — resolve §1.3 |

---

## 3. Currency — urgent

**The entire application is denominated in USD.** `rate_reference` is seeded in USD, `travel_requests.locked_fx_rate` snapshots an FX rate at HR review, `app_settings.fx_rate_usd_ngn` defaults to 1500.00, and the UI converts for display (`usdToNgn`, `ngnToUsd`, the `Money` component).

The **only** justification for that machinery was international travel. The brief removes international travel from scope entirely:

> "For international trips, the allocation comes from the ministry so it isn't done in house so we are not going to bother about international trips on this platform."

So the FX layer now has zero purpose and one very sharp edge:

> HR types `60000` into the DTA field meaning **₦60,000**. The column is USD. At the seeded rate of 1500, the platform reports **₦90,000,000**.

Three orders of magnitude, no error, no warning. This is not hypothetical — it is what happens the first time someone enters a figure from the new policy into the current form.

**Recommendation:** single-currency NGN throughout. Remove `locked_fx_rate` from the write path, retire `fx_rate_usd_ngn`, drop `usdToNgn`/`ngnToUsd` from the request flow, and re-seed every rate in Naira. Keep the international `rate_reference` rows only if there is a concrete plan to bring international travel back; otherwise delete them so nobody prices against a USD row by accident. Do this in the *same* change as the policy rewrite — a half-migrated currency model is worse than either end state.

`DECIMAL(10,2)` caps at ₦99,999,999.99, which is comfortable for a single domestic trip. No change needed there.

---

## 4. ERP integration — where all the real risk is

You asked specifically for a view on this. Here it is, bluntly.

### 4.1 The question I cannot answer without more information

**Which ERP is it?** SAP, Odoo, Microsoft Dynamics, Sage, or something bespoke? Does it expose a documented REST/SOAP API? Is it vendor-hosted or on-prem? Is there an active support contract, and who owns the integration credentials?

Every estimate below moves by weeks depending on that answer, and it is not an engineering question — it is a procurement and access question that only NIGCOMSAT ICT can settle. **Ask it this week.** In my experience the realistic outcomes are: (a) a vendor-hosted system with no third-party API access without a paid change request, (b) an on-prem system with a reachable database but no supported write API, or (c) a genuine documented API. Only (c) makes the automated write-back straightforward, and it is the least common.

### 4.2 Read (memo number → trip details) and write (submit → create memo) are not the same problem

The brief treats them as one integration. They are not, and conflating them will sink the timeline.

**Reading** is low-risk. It is idempotent, it cannot corrupt anything, and when it fails you degrade gracefully to manual entry. Build the manual path first and treat the read as an enhancement that fills the form in — that way the ERP being unavailable is an inconvenience, not an outage.

**Writing into another system's approval workflow is the hard part**, and this is where I want to push back on the framing in the brief:

> "We want the submit button on this platform to do the memo creation automatically or queue it."

**Never do it synchronously from the submit button.** If HR clicks Submit and the platform calls the ERP inline:
- ERP slow → HR stares at a spinner and clicks again → two memos for one trip.
- ERP down → HR's twenty minutes of pricing work is lost with an error toast.
- Network timeout after the ERP committed → the platform believes it failed, HR retries, the MD gets a duplicate.

### 4.3 What I recommend instead: the outbox pattern

HR's submit commits **locally, in one transaction**, and enqueues an ERP push job. That is it. The request is safe the instant the button is clicked, regardless of the ERP's state. A background worker drains the queue.

This requires four things, none optional:

1. **An idempotency key** on every push — memo number + request version — so a retry can never create a second memo.
2. **Visible per-request sync state**: `queued` / `pushed` / `failed`, on the HR dashboard. HR must never have to guess whether the memo landed.
3. **A manual retry**, plus an explicit **"I entered this in the ERP by hand"** escape hatch. Every integration fails eventually; if the only recovery path is a developer, the platform stops being usable the first time it breaks.
4. **A dead-letter view** so failures are surfaced, not silently retried forever.

Also, categorically: **do not write directly into ERP database tables.** ERP workflow tables carry triggers, document-number sequences, state machines, and approval-routing rows. Rows inserted behind the application's back produce memos that look right in a table and cannot be actioned by the MD. If there is no supported write API, the honest answer is that automated memo creation is not available, and Phase 0 below is the deliverable.

### 4.4 The split-brain problem — the real cost of scrapping the MD dashboard

This is the consequence I most want on record.

Once the MD approves and rejects inside the ERP, **this platform has no idea what happened to any request it submitted.** Every request sits at "sent to MD" forever. Which means:
- Staff cannot see the outcome of their own request here — the pending-requests list, the whole point of the staff dashboard, becomes a list of things whose fate is unknown.
- Travel history is incomplete.
- Any future reporting on approved spend is wrong, because the platform has approvals it never learns were rejected.

There are only three ways to close the loop:
1. **ERP webhook** on approval/rejection → best, if the ERP supports it.
2. **Poll the ERP** for memo status → acceptable, needs the read API.
3. **HR manually records the MD's decision** → the fallback, and it must exist regardless of 1 and 2, because it is the only option that works when the integration is down.

Whichever you choose, decide it now. Retrofitting outcome tracking after launch means backfilling every request submitted in the interim by hand.

### 4.5 The memo number is now a foreign key into another system

Treat it accordingly:

- **Format-validate it** — if there is no read API, the memo number is unverified free text, and a typo silently decouples the two systems.
- **Enforce uniqueness carefully.** A naive `UNIQUE(memo_number)` breaks resubmission, because the current model creates a *new row* for each version sharing a `travel_group_id` (`resubmitRequest`). What you want is a partial unique index over live statuses only:

  ```sql
  CREATE UNIQUE INDEX ON travel_requests (memo_number)
    WHERE status IN ('pending_hr', 'queued_for_erp', 'in_erp', 'approved');
  ```
  A rejected version does not block a resubmission; two live requests for the same memo cannot coexist.
- Unless §1.4 says a memo can carry several travellers, in which case this all changes.

### 4.6 Phasing — so nothing waits on the ERP answer

**Phase 0 — zero ERP dependency. Ship this first.**
Staff enter the memo number and trip details manually. The platform calculates against the policy, HR reviews and adjusts, and the output is a **generated, printable memo plus a copy-to-clipboard cost breakdown** that HR pastes into the ERP.

I want to argue for this properly, because the brief pushes back on it:

> "this platform takes away all that manual labor but it will be defeated if after this platform does all the calculations, the HR still has to go the ERP and create a memo"

Respectfully, that overstates it. The manual labour HR is actually drowning in is **the calculation** — looking up grade bands, working out coverage percentages, multiplying by days, aggregating five line items, and getting it right across every request. That is what this platform eliminates on day one. Pasting a finished breakdown into an ERP form is perhaps ninety seconds of clerical work per request. Phase 0 removes maybe 90% of the effort and 100% of the arithmetic errors, with **zero** dependency on an integration whose feasibility is currently unknown.

The automated write-back is worth building. It is not worth *blocking the entire platform* on, and it certainly is not worth blocking on while the ERP vendor takes six weeks to answer an email. Ship the calculator, bank the win, then integrate.

**Phase 1 — read integration.** Memo number lookup auto-fills the form. Fails soft to manual entry. Low risk, immediately useful, and it validates that the memo exists and is HOD-approved (§1.6).

**Phase 2 — write integration.** Outbox, idempotency, sync status, manual override. Only after §4.1 has a real answer.

**Phase 3 — outcome sync.** Webhook or polling to close the loop from §4.4.

---

## 5. Scrapping the MD dashboard

**The direction is defensible.** The MD keeps a single inbox rather than two, and the platform stops trying to be the system of record for an approval it does not own. Fewer places for the truth to live is usually correct.

**Two arguments for restraint:**

**Do not delete the `approvals` table or the status machinery.** Repurpose them. `approvals` becomes the record of the *ERP-reported* MD outcome rather than the place the decision is made. You keep the audit trail, the rejection reasons, and staff visibility — all of which you otherwise lose entirely (§4.4). Deleting the MD *interface* is right; deleting the MD *data model* throws away the only structure capable of holding the answer that has to come back from the ERP.

**Consider keeping a read-only MD view rather than nothing.** The MD dashboard already exists and works. The ERP memo will carry a total; it will not carry the itemised breakdown, the coverage rationale, the overlap warnings, or HR's note. If the MD ever asks *"why is this ₦467,500?"*, a read-only view answers it for free. Deleting code is cheap and reversible; rebuilding a dashboard under pressure after launch is not. My recommendation: remove the approve/reject actions, keep the view behind the existing `md` role, revisit in a month.

Concretely, what changes: `mdApproveReject` retires, the `pending_md` status becomes something like `queued_for_erp` → `in_erp`, the MD RLS update policy narrows to read-only, and `/md` loses its action buttons.

---

## 6. Origin, destination, and the routes

### 6.1 The four origins are already seeded

Abuja, Lagos, Kaduna and Gombe all exist in `airports` (ABV, LOS, KAD, GMO) from `20260822160000_airports.sql`. No migration needed for origins — just constrain the dropdown to those four (they are the duty stations) and keep destination open.

### 6.2 A flat ₦150,000 airfare default will be wrong on most routes

Abuja → Lagos is a dense, competitive route. Kaduna → Gombe barely has scheduled service. Applying the same ₦150,000 to both means HR overrides the figure on nearly every request — at which point the default is not saving anyone time, it is just a number to be deleted.

Recommendation: **a per-route rate table with ₦150,000 as the fallback**, not ₦150,000 as the rule. The schema for this mostly exists (`rate_reference` keyed by destination, plus the `airports` FKs on `travel_requests`) and it needs re-keying to route rather than destination-plus-level. Seed the eight or ten routes that actually recur; let everything else fall back to the default.

Corollary: some origin/destination pairs have no realistic air option at all. Those should default to road mode, not to a ₦300,000 airfare nobody can book.

### 6.3 Keep the flight-price lookup

`src/lib/utils/flight-search.ts` and the HR flight-lookup card become **more** valuable under the new scope, not less. HR now has explicit authority to adjust airfare "depending on the unique situation of the staff" — a one-tap live fare check is exactly the evidence needed to justify departing from the default, and it is already built. Keep it; point it at NGN and Nigerian routes.

### 6.4 Smaller edge cases

- **Destination == origin** should be rejected at validation. Nothing currently stops it.
- **Trip duration vs. days allowed are different things.** The brief gives HR authority over "the number of days allowed", which is not necessarily `return_date - depart_date`. Model these as two fields: `days_requested` (derived from the dates, staff-side) and `days_approved` (HR-side, defaulting to requested). **All DTA and local-running maths must key off `days_approved`.** One `days` column cannot represent both, and conflating them will produce disputes that are impossible to adjudicate after the fact.
- **Mixed-mode trips** (fly out, drive back) are not representable — `mode` is a single value for the whole trip. Probably acceptable; confirm.
- **Multi-leg trips** (Abuja → Lagos → PH) are not supported and coverage would be ambiguous across legs. Confirm out of scope.
- **One-way travel** — the entire policy is written round-trip ("to and fro"). What happens on a one-way trip? Halve the transport, presumably, but say so.

---

## 7. Auto-calculation on the staff form — three engineering rules

The brief moves cost calculation forward, from HR's review to the moment the staff member fills the form. That is the right call — staff see what they are asking for, and HR reviews a number rather than producing one. Three non-negotiables come with it:

**1. The server calculates. Always.** The client may *preview*, but the amount persisted must be recomputed server-side from the staff member's grade and the trip parameters. A client-supplied figure must never reach the database. The current architecture already has the right shape for this (server actions in `requests.actions.ts` own every write) — keep it that way.

**2. Snapshot the rates onto the request.** If an admin edits the AM–SM DTA next Tuesday, every request already sitting in HR's queue must keep the rate it was priced at. This is the same reasoning that produced `locked_fx_rate`, applied to policy rates instead — store a `policy_version` or a rate-snapshot JSON on the row at submit. Without it, a rate change silently rewrites history and HR approves a number that no longer matches what the staff member saw.

**3. One calculator, one file.** A single pure function — `src/lib/policy/calculate.ts` — consumed by the form preview, the server insert, and HR's live recalculation. Any duplication of this logic across client and server *will* drift, and the symptom is the preview and the saved figure disagreeing, which destroys trust in the platform faster than anything else it could do wrong.

Keep `rate_overrides`. It already logs every HR deviation from the reference rate (`hrReviewRequest`), and under the new scope — where HR explicitly has discretion over days, taxi, and airfare — it becomes the evidence trail for *why* someone was paid above policy. That is an audit requirement for a parastatal, not a nice-to-have.

**And: the cost engine needs unit tests.** There is currently no test runner in `package.json` at all. Once the calculator is the entire value proposition of the platform, a table-driven test suite over every (band × coverage × mode × days) combination is the cheapest insurance available. Write the tests against the policy table, from HR's own worked examples, before writing the calculator.

---

## 8. Authentication — OTP vs. "on-prem sign-in"

You asked for limitations and better alternatives. Taking "on-prem sign-in" to mean *authenticate against NIGCOMSAT's own directory (Active Directory / LDAP) using existing domain credentials* rather than emailed one-time codes.

### 8.1 What is genuinely good about the idea

- **One credential.** Staff already have a domain login. Not waiting for an email is a real improvement, and I suspect slow mail delivery is the actual complaint behind this request.
- **Centralised deprovisioning.** Disable the AD account and access dies everywhere at once — better than today's `staff.active` flag, which someone has to remember to flip.
- **Directory as source of truth.** Name, grade, department could sync from AD, which kills a whole category of manual admin data entry and directly serves the brief's "fetches the staff name and level on login".

### 8.2 Why direct on-prem LDAP is the wrong way to get there

1. **Reachability.** The app runs on Supabase and Vercel — cloud infrastructure that cannot reach an on-prem LDAP server. Closing that gap means either exposing LDAP to the public internet (do not) or standing up a VPN or tunnel. That is a firewall change, an owner, and a permanent maintenance burden that nobody has costed.
2. **Availability coupling.** If the domain controller or the tunnel is down, **nobody can log in at all.** Email OTP fails soft — you can get in from anywhere with a mailbox.
3. **It is backwards for a travel app.** The user population is, by definition, people who are away from the office. Directory auth that effectively requires the corporate network is a poor fit for the one product where being off-site is the norm.
4. **Password handling is a downgrade.** A direct LDAP bind means this application receives staff domain passwords in plaintext, in memory, on every login. OTP never handles a reusable secret at all. Swapping a credential that cannot be replayed for one that can — and the *domain* credential at that — is a step backwards in security posture, whatever it does for convenience.
5. **It guts the security core.** Supabase Auth has no LDAP support. Going that route means either abandoning Supabase Auth — and with it `auth.uid()` and `current_staff_role()`, which every RLS policy in the schema is built on — or bridging into it with custom token minting. Both are invasive rewrites of the part of the system it is least safe to rewrite. This is not a login-screen change.

### 8.3 What I recommend instead

**Microsoft Entra ID (Azure AD) SSO over OIDC.**

If NIGCOMSAT runs Microsoft 365 for email — and "the user's official email" in the original PRD strongly suggests it does — then an enterprise identity provider **already exists, is already cloud-reachable, and is already the system of record for staff accounts.** Staff click "Sign in with your NIGCOMSAT account" and use the same credentials as their email. Supabase Auth supports Azure as an OAuth provider natively, so this is configuration plus a login-button change rather than an auth rewrite.

It delivers everything the MD is actually asking for:
- corporate credentials, corporate control, corporate deprovisioning
- no OTP emails, no waiting
- MFA and conditional-access policies inherited from ICT's existing configuration, for free
- works off-network, which on-prem LDAP does not
- if AD is on-premises, **Entra Connect already syncs it** — most organisations with Microsoft 365 are running this today

Ranked alternatives:

| Option | Effort | Verdict |
|---|---|---|
| **Entra ID / M365 SSO (OIDC)** | Low | **Recommended.** Gets the MD's actual goal with none of the plumbing |
| Keep OTP, reduce friction (magic link, longer session, remember-device) | Very low | Good stopgap; does not address "corporate control" |
| On-prem LDAP/AD direct bind | High | Only if the whole app moves on-prem — see below |
| Self-hosted Keycloak as a broker | Medium-high | Justified only if there is no M365 tenant |

### 8.4 The question behind the question

Worth asking the MD directly: **is the concern security, cost, or data residency?** Those have different answers, and the third one changes the whole project.

For a government satellite agency, "official data must reside on NIGCOMSAT infrastructure, not a foreign cloud" is an entirely plausible real driver — and if that is what is meant, the login screen is the wrong thing to be discussing. That would be a decision to self-host the whole platform (self-hosted Supabase or plain Postgres, plus backups, TLS, patching, monitoring, and somebody on call), and it needs to be surfaced **now**, while it is a deployment choice, rather than after launch when it becomes a migration.

If the answer is just "OTP emails are slow and I want staff using their work login" — Entra SSO, one sprint, done.

---

## 9. What survives, what changes, what goes

| | Item |
|---|---|
| **Keep as-is** | Auth shell and session handling · RLS pattern and `current_staff_role()` · route protection (`proxy.ts` + `ROUTE_ACCESS`) · staff and HR dashboards · `airports` table and route keys · request versioning (`travel_group_id` / `previous_version_id`) · `approvals` audit trail · `rate_overrides` · UI component library · flight-price lookup |
| **Rework** | Cost engine (complete rewrite) · currency USD → NGN · `levels` → grade bands · destination-driven coverage · request schema (memo number, `days_approved`, transport split) · HR review screen (edit a calculation rather than author one) |
| **Retire** | FX machinery (`locked_fx_rate`, `fx_rate_usd_ngn`, USD conversions) · international `rate_reference` rows · MD approve/reject actions · `levels.coverage_percent` |
| **New** | Memo-number entry and validation · grade-band rate tables · policy calculator + test suite · ERP outbox and sync status · MD outcome recording · rate snapshotting |

---

## 10. Questions to take back — consolidated

**Blocking (calculator cannot be built):**
1. Does the 75% apply to allowances only, or to airfare and taxi as well? (§1.1)
2. Is DTA paid per day or per night, and are travel days included? (§1.2)
3. Does DTA absorb accommodation, or is accommodation a separate reimbursable? (§1.3)
4. Can one memo cover multiple travellers? (§1.4)
5. What is the authoritative grade ladder, and how does every grade map to the five bands — specifically Deputy Director, Director, and Manager? (§2.2)

**Blocking (integration cannot be scoped):**
6. Which ERP, and does it expose a documented read/write API? (§4.1)
7. How does the MD's approve/reject decision get back to this platform? (§4.4)
8. Is the memo HOD-approved before the staff member enters it here? (§1.6)

**Needed soon:**
9. Is the money an advance (with retirement) or a reimbursement? (§1.5)
10. Is the MD's on-prem preference about security, cost, or data residency? (§8.4)
11. `50,0000` for road trips — ₦50,000 or ₦500,000? (§1.7)
12. **What is the rest of the sentence that begins "One ma"?** (§0)

---

## 11. My recommended sequence

1. **Get answers to §10 questions 1–5.** Nothing else is worth starting; every one of them changes the shape of the code.
2. **Fix the currency model.** NGN throughout, FX machinery out. This is the live bug (§3).
3. **Build the policy calculator as a pure, tested module** — before any UI touches it. Test cases come from HR's own worked examples, not from my reading of the brief.
4. **Rebuild the request flow around it**: memo number in, auto-calculation, HR adjusts, rates snapshotted.
5. **Ship Phase 0** — printable memo plus copy-ready breakdown. This is a usable product that eliminates the arithmetic, and it depends on nothing outside our control.
6. **Then, and only then, integrate the ERP** — read first, write second, outcome sync third, in that order.
7. **Auth (Entra SSO) can run in parallel** with any of the above. It touches almost nothing the calculator work touches.

The single most important structural argument in this document: **do not let the ERP integration block the calculator.** The calculator is the value. The integration is the convenience. Sequencing them the other way round risks a platform that is technically integrated and has not saved HR a single minute — or, worse, one that is still waiting on a vendor email six weeks from now with nothing shipped.

answers to questions raised:Theres no more requirement. The truncating was an error. The 75% applies to the DTA, so scenerio A is right. Yes the coverage us destination driven. DTA is per night. DTA absorbs accomodation, staffs are expected to sort accommodation from DTA. before the staff comes on this platform with a memo, it must have already been approved by the HOD on the ERP. I don't even know if the ERP has the ability to pick up such detail through its API. yes hundred thousand naira for road trip roundtrips and three hundred thosand for air roundtrip. Yes airport taxi is eighty thousand naira flatrate regardless of city. Yes airport taxi on roadtips shoulld be 0. I have added the levels in the organisation below. SO scrap out the old levels and replace with the new ones. I like your recommendation about introducing explicit grade bands table. The entire application should be denominated in naira. Theres no plan to bring international travel back for now. The ERP being used is microsoft dynamics. Each staff is given credentials for the platform, for travel requests only one HR staff's ERP is given such credentials. For the MD approval, Polling the ERP api sound like a good idea. The money is reimbursement. The on-prem was that they felt the otp was too complicated and stressful. 

DESIGNATIONs in the organisation
MANAGING DIRECTOR
EXECUTIVE DIRECTOR
GENERAL MANAGER
DEPUTY GENERAL MANAGER
ASSISTANT GENERAL MANAGER
SENIOR MANAGER
MANAGER
DEPUTY MANAGER
ASSISTANT MANAGER
SENIOR OFFICER
SENIOR TECHNICAL OFFICER 
OFFICER I
OFFICER II
ASSISTANT OFFICER I