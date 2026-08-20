# NIGCOMSAT Travel Policy — Demo / Placeholder

**Status:** Placeholder. This is a plausible, internally-consistent travel policy built so the system has real data to demo and test against — **not** the actual NIGCOMSAT travel policy. Replace every number below with the real one whenever HR finalizes it; nothing about the system needs to change to do that (see §4).

## 1. How the mechanism works (unchanged, no new code)

The system already supports exactly one lever per grade — `coverage_percent` — applied to the sum of all five allowance categories:

```
Total_Raw_Allowance = allowance_local + allowance_flight + allowance_taxi + accommodation + per_diem
Final_Cost = Total_Raw_Allowance × (coverage_percent / 100)
```

(`src/lib/utils/formatting.ts` — `calculateTotalRawAllowance`/`calculateFinalCost`, PRD §5.1.) Reference amounts for each of the five categories, per destination and grade, live in `rate_reference` and back the "Suggest Standard Rates" button HR uses (PRD §3.2).

## 2. Grade → Coverage

| Grade | Coverage | Flight Class |
|---|---:|---|
| Junior Staff | 50% | Economy |
| Senior Staff | 60% | Economy |
| Assistant Manager | 65% | Economy |
| Manager | 70% | Economy |
| Deputy Director | 80% | Business |
| Director | 85% | Business |
| **General Manager** | **90%** | Business |
| Executive Director | 100% | First |

**On your "GM gets 50% off hotels" example specifically:** taken literally, a flat 50% coverage for GM would put General Manager *below* Junior Staff in this table — coverage is meant to increase with seniority, not stay flat. So GM is set to 90% here instead: a General Manager on a $900 hotel bill effectively pays $90 out of pocket (NIGCOMSAT covers $810 — a 90% discount from their perspective, not 50%). If 50% is actually the number HR wants for GM, change it in one place: **Admin → Level Configuration → General Manager → Coverage %** — no redeploy, no code change, takes effect on the next request reviewed.

## 3. Grade + Destination → Reference Rates

The "and destination" half of the policy lives in `rate_reference`: the same grade gets different reference numbers depending on where they're going, and — since flight fare scales with cabin class — different grades get different flight estimates for the *same* destination. Seeded for a representative spread (Admin → Rate Management to see/edit the full table):

**Domestic** (Lagos, Abuja, Port Harcourt, Kano) — modest accommodation/per-diem/flight figures, economy fares across the board.

**International** (London, Dubai, Johannesburg, Washington DC) — materially higher accommodation/per-diem, and flight estimates that scale hard with seniority because cabin class does:

| Destination | Grade | Flight Estimate | Why |
|---|---|---:|---|
| London | Manager | $950 | Economy return |
| London | General Manager | $2,200 | Business return |
| London | Executive Director | $3,500 | First return |

All figures are USD (PRD §5.2 — costs are stored in USD everywhere, converted to NGN for display using the FX rate Admin sets under FX Rate Override; domestic trips are USD-denominated too, just small numbers, not literal NGN figures — the original Sprint 0 seed had this backwards for Lagos/Abuja, fixed as part of this pass).

## 4. This is genuinely a placeholder

Everything in §2 and §3 is admin-editable today (Level Configuration + Rate Management, built in this pass — see `UI_UX_DESIGN_PLAN.md` §3.5):

- Coverage percentages: **Admin → Level Configuration**, inline edit, takes effect immediately.
- Reference rates per destination/grade/mode: **Admin → Rate Management**, add or edit rows.

When the real HR policy document exists, transcribing it is data entry through the Admin UI, not an engineering task.

## 5. Where this lives in code

`supabase/migrations/20260820130000_demo_travel_policy.sql` — written as idempotent upserts (safe to re-run, safe on a database that already has the original `seed.sql` rows from Sprint 0). `supabase/seed.sql` no longer seeds levels/rates (moved here so it applies via the normal migration path on every environment, not only on `db reset`).
