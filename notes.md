# Domestic Travel Cost Platform — Product Requirements Document

**Version:** 1.1 — policy confirmed
**Status:** Ready for engineering handoff
**Date:** 17 September 2026
**Owner:** Engineering (Bashir)
**Reviewers:** MD, HR, NIGCOMSAT ICT
**Source:** REVISED_SCOPE.md rev 3, todays-task.md

Replaces manual travel-policy calculation between NIGCOMSAT's Microsoft Dynamics ERP and HR with a self-service cost calculator staff, HR and the MD all read from.

---

## 1. Executive Summary

> A staff member signs in, enters an ERP memo number the HOD has already approved, adds who is travelling, and the platform prices the trip against NIGCOMSAT's travel policy automatically. HR reviews the number — adjusting only days, transport and airport taxi — and submits. The platform never owns the approval; it owns the arithmetic, the audit trail, and the policy. The MD keeps approving in the ERP, unchanged.

### Confirmed since v1.0 — no longer open
- ✓ **No Assistant Officer II**, and no further grade beyond the fourteen listed. The ladder in §8 is confirmed exhaustive.
- ✓ **DTA and local running are not halved** on one-way trips. Only transport and airport taxi are — as already specified in §8.
- ✓ **DTA and local running are paid on both travel days.** Depart Monday, return Wednesday counts as 3 days, in full.

---

## 2. Background & Problem

**Today:** a staff member writes a travel memo in the Dynamics ERP. The HOD reviews and approves it there. HR then manually calculates the travel allowance against policy — by hand, in a spreadsheet or on paper — and creates a second memo for the MD to approve.

**What's wrong with that:** the calculation takes HR roughly twenty minutes per request, depends on whoever is doing it knowing the current policy rates for every one of fourteen grades, and has already produced a real incident — a figure typed as Naira read back as US Dollars, turning a ₦60,000 allowance into a reported ₦90,000,000. There is also no point in the flow where a staff member can check the status of their own request without asking HR directly.

**What changes:** the platform in this document sits between the ERP and the people who use it. It does not replace the ERP's approval workflow — the HOD still approves there, and so will the MD. It replaces the manual arithmetic HR currently does, and gives staff a place to see the outcome once it's decided.

---

## 3. Goals & Success Metrics

**Goals:** remove manual policy arithmetic from HR's workflow · make grade-band and coverage-tier lookup errors structurally impossible rather than a matter of care · keep a full audit trail for every figure that isn't the policy default · ship a usable product before any part of the ERP integration exists · keep the codebase portable to a future government-owned host.

| Metric | From | To |
| :--- | :--- | :--- |
| HR time per request | ~20 min | ~90 sec |
| FX/currency mispricing incidents | ₦90,000,000 (one real incident) | ₦0 |
| Silently mispriced requests from an unmapped grade | — | 0 — must hard-refuse instead |
| Staff can see their own request's outcome | — | Self-serve, once Phase 5 ships |

---

## 4. Users & Roles

### Staff
- Raise a request against an already-approved ERP memo number
- Add colleagues travelling with them
- See a live cost estimate while filling the form
- ~~Cannot approve, edit policy rates, or see anyone's request they aren't named on~~

### HR
- Review every request, with the total already computed
- Adjust days allowed, transport cost, airport taxi
- Submit — which queues the push into the ERP
- ~~Cannot edit DTA or local running directly; those are policy-derived~~

### MD
- Read-only view: total cost, coverage rationale, HR's note
- Approves or rejects the memo in the ERP, as before
- ~~No approve/reject action on this platform — that dashboard is retired~~

### Admin
- Edits grade-band rates, coverage-tier cities, policy defaults
- Edits which designation maps to which band
- ~~Does not get a per-route fare editor — cut from scope~~

---

## 5. Glossary

| Term | Definition |
| :--- | :--- |
| **DTA** | Duty Travel Allowance — a daily living allowance, paid per day of the trip. |
| **Local running** | A second daily allowance covering incidental local movement, also paid per day. |
| **Coverage tier** | 100% for Lagos, Abuja and Port Harcourt; 75% everywhere else. Applies only to DTA and local running. |
| **Grade band** | One of four rate groups (B1–B4) that NIGCOMSAT's fourteen designations map onto. |
| **Memo number** | The identifier the ERP generates once the HOD approves a staff member's travel memo — the entry point into this platform. |
| **Duty station** | The four cities a trip may originate from: Abuja, Lagos, Kaduna, Gombe. |
| **Policy snapshot** | A frozen copy of every rate used in a request's calculation, stored at submission so later rate changes never rewrite history. |
| **Outbox** | The queue that holds a costed memo until a background job pushes it into the ERP — never a direct, synchronous write. |

---

## 6. User Journey

*Steps outside the dotted circle already happen in the ERP, unchanged by this platform.*

0. **HOD approves the memo** *(in the ERP)* — Out of scope here — the platform assumes this has already happened.
1. **Staff signs in and enters the memo number** — Name and designation come from the session, never typed by hand.
2. **Staff adds trip details and travellers** — Origin, destination, dates, one-way/return, and anyone travelling with them.
3. **Platform prices the trip live** — Per-traveller DTA, local running, transport and airport taxi, against policy.
4. **HR reviews and adjusts** — Only days allowed, transport, and airport taxi are editable; everything else is locked policy.
5. **HR submits** — Commits locally and queues the ERP push — never a synchronous call from the submit button.
6. **MD approves or rejects** *(in the ERP)* — Out of scope here — this platform only shows the total and the reasoning behind it.
7. **Outcome polled back** — A scheduled job reads the MD's decision and shows it to the staff member who raised the request.

---

## 7. Functional Requirements

*Priority follows MoSCoW. Phase references the build roadmap in §13.*

### A. Authentication & Session

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-1 | Staff, HR, MD and Admin sign in through one auth shell; visiting a route outside your role's area 404s rather than redirects. | Must | 0 |
| FR-2 | Replace OTP sign-in with Entra ID SSO — contingent on the eventual hosting environment allowing outbound HTTPS. | Must | 1 |
| FR-3 | On login, name and designation are read from the staff record, never entered by hand. | Must | 0 |

### B. Staff Travel Request

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-4 | The memo number is step one of the request; format-validated in Phase 0, looked up against the ERP in Phase 3. The form must work fully on format validation alone. | Must | 0 |
| FR-5 | The requester is auto-added as a traveller; colleagues can be added from the staff directory, each showing their designation. | Must | 0 |
| FR-6 | Origin is restricted to Abuja, Lagos, Kaduna, Gombe. Destination is the airports list, or free text for road-only places. Destination ≠ origin. | Must | 0 |
| FR-7 | A one-way/return toggle and travel dates resolve to a shown, inclusive day count ("3 days, 15–17 Sep"). | Must | 0 |
| FR-8 | A live per-traveller cost estimate updates as the form is filled, with a plain-language note on which coverage tier applied and why. | Must | 0 |
| FR-9 | A request needs at least one traveller and a memo number not already in an active request before it can be submitted. | Must | 0 |
| FR-10 | Staff can see the outcome of a request they raised or are named on. | Should | 5 |

### C. Cost Calculator

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-11 | One shared calculation prices a single traveller and is the only place this arithmetic exists — used identically for the staff preview, the stored amount, and HR's live recalculation. | Must | 0 |
| FR-12 | The amount persisted is always recomputed on the server from designation and trip parameters. A client-supplied figure is never trusted or stored. | Must | 0 |
| FR-13 | Every designation maps to exactly one rate band. An unmapped designation must refuse the calculation and route to HR — never default to the lowest band or to zero. | Must | 0 |
| FR-14 | Every rate used in a calculation is snapshotted at submission, so a later policy change never rewrites a figure already shown or queued. | Must | 0 |

### D. HR Review & Submission

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-15 | HR's queue shows each request with its total already computed, never a blank form. | Must | 0 |
| FR-16 | HR edits exactly three fields — days allowed, transport cost, airport taxi. DTA and local running recompute live and are otherwise locked. | Must | 0 |
| FR-17 | On a multi-traveller request, days apply trip-wide; transport and taxi are set per traveller. | Must | 0 |
| FR-18 | Every deviation from the policy default is logged, forming the audit trail for above- or below-policy payments. | Must | 0 |
| FR-19 | A printable and copy-to-clipboard breakdown is available for every reviewed request — the primary route into the ERP today, and the permanent fallback afterward. | Must | 0 |
| FR-20 | Submitting never calls the ERP synchronously; it queues the push, shows a visible sync state, and allows retry or manual override. | Should | 4 |

### E. MD Visibility

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-21 | The MD gets a read-only view — total cost, coverage rationale, HR's note. Approval happens in the ERP; the approve/reject action on this platform is retired. | Must | 0 |
| FR-22 | The MD's ERP decision reflects back into this platform automatically. | Should | 5 |

### F. Admin Configuration

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-23 | Admin edits grade-band rates, the 100%-coverage city list, and the three policy defaults without a deployment. | Must | 0 |
| FR-24 | Admin edits which designation maps to which rate band. | Must | 0 |
| FR-25 | A per-route fare table (a different air fare per origin-destination pair) is not built. | Won't | — |

### G. ERP Integration & Outcome

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-26 | A valid memo number can look the trip up directly from the ERP and auto-fill the form; any failure falls soft to manual entry, which keeps working regardless. | Should | 3 |
| FR-27 | Writing a memo into the ERP uses an idempotency key (memo number + version) so a retry can never create a duplicate. | Must | 4 |
| FR-28 | No direct writes to ERP database tables — only through its supported integration surface. | Must | 4 |
| FR-29 | An authentication health check alerts the team if the ERP credential in use stops working. | Should | 4 |
| FR-30 | A scheduled job polls the ERP for the MD's decision on each submitted request and records it. | Should | 5 |

### H. Audit & Compliance

| ID | Requirement | Priority | Phase |
| :--- | :--- | :--- | :--- |
| FR-31 | Every monetary figure is Naira. No foreign-currency handling exists anywhere in the product. | Must | 0 |
| FR-32 | A memo number cannot be in two active requests at once, though a returned request can be resubmitted under the same memo. | Must | 0 |

---

## 8. The Travel Policy — Business Rules

This is the specification the calculator implements exactly. Coverage applies only to DTA and local running; transport and airport taxi are paid at full flat rates regardless of destination.

### Coverage tiers
- **100% cover:** Lagos, Abuja, Port Harcourt.
- **75% cover:** every other destination.

The tier that applies is the one the traveller is *in* — an Abuja-based MD travelling to Port Harcourt is on 100%, while a Port Harcourt-based officer travelling to Gombe is on 75%.

### Grade bands

| Band | Designations | DTA/day @100% | @75% | Local running/day @100% | @75% |
| :--- | :--- | ---: | ---: | ---: | ---: |
| B1 | Managing Director · Executive Director | ₦60,000 | ₦45,000 | ₦18,000 | ₦13,500 |
| B2 | General Manager · Deputy General Manager · Assistant General Manager | ₦40,000 | ₦30,000 | ₦12,000 | ₦9,000 |
| B3 | Senior Manager · Manager · Deputy Manager · Assistant Manager | ₦30,000 | ₦22,500 | ₦9,000 | ₦6,750 |
| B4 | Senior Officer · Senior Technical Officer · Officer I · Officer II · Assistant Officer I | ₦15,000 | ₦11,250 | ₦4,500 | ₦3,375 |

**Confirmed exhaustive:** there is no Assistant Officer II, and no further grade beyond these fourteen. A designation that ever fails to match one of them must still refuse and route to HR rather than guess (FR-13) — the confirmation removes the immediate risk, not the safeguard.

### Transport & airport taxi (flat defaults, HR-overridable)

| Item | Default | Notes |
| :--- | ---: | :--- |
| Air, each way | ₦150,000 | ₦300,000 round trip. No per-route table. |
| Road, each way | ₦50,000 | ₦100,000 round trip. Same treatment as air. |
| Airport taxi | ₦40,000 × legs | Per traveller, even on a shared trip. ₦0 on road trips. |

### The formula

```
days       = (return date − depart date) + 1, HR's override wins if set — paid in full on both travel days
coverage   = destination is Lagos/Abuja/Port Harcourt ? 100% : 75%
legs       = one-way trip ? 1 : 2

dta        = band.dta_per_day           × coverage × days
local      = band.local_running_per_day × coverage × days
transport  = (air ? 150,000 : 50,000) × legs   — not scaled by coverage
taxi       = (air ? 40,000 × legs : 0)         — not scaled by coverage

traveller total = dta + local + transport + taxi
request total    = sum of every traveller on the memo
```

**One-way travel** halves transport and taxi only. DTA and local running are per-day living costs, not journey costs — a one-way traveller spending three days in Kano lives and moves for three days exactly as a return traveller does, so halving them would pay two people in the same city different allowances on the same days. **Confirmed** — not halved.

### Worked examples

| Route | Band | Mode | Days | Cover | Total |
| :--- | :--- | :--- | ---: | ---: | ---: |
| Abuja → Kano | B3 | Air | 3 | 75% | ₦467,500 |
| Gombe → Lagos | B2 | Air | 2 | 100% | ₦484,000 |
| Kaduna → Kano | B4 | Road | 4 | 75% | ₦158,500 |
| Abuja → Port Harcourt | B1 | Air | 1 | 100% | ₦458,000 |
| Abuja → Kano, one-way | B3 | Air | 3 | 75% | ₦277,750 |

---

## 9. Non-Functional Requirements

| Area | Requirement |
| :--- | :--- |
| **Security** | Row-level access control at the database, not just in the UI. A traveller who isn't the requester can still see the request they're named on. The server is the sole authority on any stored amount. |
| **Portability** | No platform-specific hosting features. Self-hosted Supabase preserves the entire auth/RLS model if the deployment moves to a government-owned cloud. |
| **Auditability** | Rate overrides and policy snapshots give a complete trail for every request — a compliance requirement for a parastatal, not optional polish. |
| **Reliability** | ERP writes are queued with retries and a dead-letter view, never a best-effort synchronous call that can silently fail or double-submit. |
| **Performance** | The cost preview feels instant — a pure, synchronous calculation with no network round-trip. |
| **Data integrity** | The memo-number constraint and the exhaustive designation-to-band mapping are enforced by the database, not only in application code. |

---

## 10. What Stays the Same

The rebuild is the pricing core, not the whole product. Untouched: the sign-in and session shell · route protection by role · request versioning · the override-logging mechanism · the UI component library · the duty-station/airport list · the overlap warning when a traveller has two trips at once · dashboard layouts and navigation.

---

## 11. Out of Scope

**Not building:** international travel (funded by the ministry, not this platform) · accommodation as a separate line (DTA absorbs it) · retirement/reconciliation, since this is a reimbursement model, not an advance · a per-route fare table · HOD approval inside this app (already happens in the ERP) · MD approve/reject inside this app · budget ceilings · AI-suggested rates · any USD/FX handling.

**Deferred, not cancelled:** multi-leg trips, and mixed-mode travel for a single traveller. The data model must not actively prevent adding either later.

---

## 12. Assumptions & Dependencies

The HOD has already approved a memo in the ERP before it reaches this platform — there is no HOD role or gate here. One HR account holds the ERP integration credentials, because one HR person currently handles this work. The MD's decision comes back by polling the ERP, not a webhook, because the ERP does not push outcomes. Entra ID SSO answers the request to move off OTP, provided the eventual hosting environment allows outbound internet access — if it does not, a self-hosted identity provider is a materially larger, separate workstream. Which Dynamics product, version and deployment model NIGCOMSAT runs is still an open question for ICT, and gates the entire ERP integration (Phases 3–5).

---

## 13. Release Phasing

| Phase | Delivers | Gate |
| :--- | :--- | :--- |
| 0 | Currency fix, grade bands, the calculator with its test suite, the new request/travellers schema, HR's three-field review, printable memo, MD to read-only. **A complete, usable product on its own.** | Nothing external |
| 1 | Entra ID SSO, replacing OTP. | Hosting allows outbound internet |
| 2 | Migration to a government-owned cloud host. | Provider chosen, infra owner named |
| 3 | ERP read — memo lookup auto-fills the form. | Dynamics product/version confirmed |
| 4 | ERP write — the outbox, idempotency, sync status, manual override. | Phase 3 |
| 5 | Outcome polling — the MD's ERP decision reflected back automatically. | Phase 4 |

*A full task-level breakdown of Phase 0 by owner already exists as a companion engineering document; this PRD is the product-level reference it was built from.*

---

## 14. Open Questions & Risks

The three policy questions (grade ladder, one-way treatment, both-days payment) are answered — see the confirmed box in §1 and the notes in §8. Everything below is still open, and all four sit with NIGCOMSAT ICT rather than the client.

| # | Question | Owner |
| :--- | :--- | :--- |
| Q3 | Which government cloud provider, and what does it offer — bare VMs, Kubernetes, managed Postgres? | Ask: ICT |
| Q4 | Does that environment permit outbound internet? Decides whether Entra SSO, email and the flight-price lookup are even possible — the single highest-leverage answer in this document. | Ask: ICT |
| Q5 | Which Dynamics product, version and deployment model — Business Central, F&O, or Dataverse? Gates Phases 3–5 entirely. | Ask: ICT |
| Q6 | Who owns infrastructure and on-call in NIGCOMSAT ICT after launch? | Ask: ICT |

---

*Sources: REVISED_SCOPE.md (rev 3, 10 Sep 2026) · SCOPE_CHANGE_REVIEW.md · todays-task.md. This PRD states product intent; REVISED_SCOPE.md §2–§6 remains the authoritative source for exact schema and migration detail if the two ever disagree.*
