/**
 * Database types for the Nigcomsatravel application.
 *
 * These types mirror the Supabase schema defined in
 * supabase/migrations/20260731144738_initial_schema.sql
 *
 * TODO: Replace with auto-generated types via `supabase gen types typescript`
 * once the database is deployed and accessible.
 */

// ============================================================
// Enums
// ============================================================
/** Generic key/value config store (e.g. FX rate override). PRD Section 3.4. */
export interface AppSetting {
  key: string
  value: string
  updated_by: string | null
  updated_at: string
}

/** Roles assigned to staff members (PRD Section 2.2) */
export type UserRole = 'staff' | 'hr' | 'md' | 'admin'

/** Travel request status lifecycle (PRD Section 4 — Status Enum) */
export type RequestStatus =
  | 'pending_hr'
  | 'pending_md'
  | 'hr_rejected'
  | 'md_rejected'
  | 'rejected_final'
  | 'approved'

/** Approval action status (PRD Section 4 — approvals table) */
export type ApprovalStatus =
  | 'hr_approved'
  | 'md_approved'
  | 'hr_rejected'
  | 'md_rejected'

/** Travel mode */
export type TravelMode = 'air' | 'road'

// ============================================================
// Table Row Types
// ============================================================

export interface Department {
  id: string
  name: string
  annual_budget_ceiling: number | null
}

export interface Level {
  id: string
  name: string
  coverage_percent: number
  flight_class: string | null
}

export interface Staff {
  id: string
  email: string
  first_name: string | null
  surname: string | null
  role: UserRole
  department_id: string | null
  level_id: string | null
  /** Nullable until Admin maps this person (FR-13) — the new-scope calculator hard-refuses rather than guessing a band. */
  designation_id: string | null
  active: boolean
  created_at: string
}

/** Domestic (within Nigeria) vs international — drives Flight Price Reference grouping. */
export type RouteType = 'domestic' | 'international'

/**
 * Controlled vocabulary for trip endpoints (20260822160000_airports.sql).
 * `route_type` is a generated column derived from `country_code`, so unlike
 * `RateReference.route_type` it is read-only and can't drift.
 */
export interface Airport {
  id: string
  iata_code: string
  city: string
  name: string
  country_code: string
  route_type: RouteType
  active: boolean
  created_at: string
}

/** The subset the request-form dropdown needs — see `listAirports()`. */
export type AirportOption = Pick<Airport, 'id' | 'iata_code' | 'city' | 'route_type'>

export interface RateReference {
  id: string
  destination: string
  level_id: string | null
  mode: string | null
  route_type: RouteType
  accommodation_rate: number | null
  per_diem_rate: number | null
  flight_estimate: number | null
  airport_taxi: number | null
  updated_at: string | null
  updated_by: string | null
}

export interface RateOverride {
  id: string
  request_id: string
  field_name: string
  overridden_value: number | null
  hr_staff_id: string
  timestamp: string
}

export interface RateSuggestion {
  id: string
  destination: string
  suggested_rate: number | null
  source: string | null
  status: string
  created_at: string
}

export interface TravelRequest {
  id: string
  travel_group_id: string
  previous_version_id: string | null
  staff_id: string
  destination: string
  origin: string | null
  /**
   * Resolved airport for `origin`/`destination` (20260822160000_airports.sql).
   * Nullable: road trips may have no airport, and older rows may name a city
   * that isn't seeded. Null means "no route key" — degrade, don't guess.
   */
  origin_airport_id: string | null
  destination_airport_id: string | null
  mode: string | null
  days: number | null
  reason_for_travel: string | null
  allowance_local: number | null
  allowance_flight: number | null
  allowance_taxi: number | null
  accommodation: number | null
  per_diem: number | null
  total_cost: number | null
  final_cost: number | null
  status: RequestStatus
  locked_fx_rate: number | null
  submitted_at: string
  depart_date: string
  return_date: string
  created_at: string
  updated_at: string
  /** PRD §6 step 1 — the ERP memo number the HOD already approved. Null on pre-Phase-0 rows. */
  memo_number: string | null
  trip_type: TripType | null
  /** Flat defaults + coverage tier actually used at submission (FR-14). Null on pre-Phase-0 rows. */
  policy_snapshot: PolicySnapshot | null
  /** Sum of request_travelers.traveller_total. Null if any traveller is unmapped (FR-13) — HR must complete those manually. */
  total_ngn: number | null
}

/** PRD §8: an Abuja-based traveller going to Kano is one-way for transport/taxi only — DTA/local running are never halved (confirmed, §1). */
export type TripType = 'one_way' | 'return'

export interface PolicySnapshot {
  transport_air_each_way: number
  transport_road_each_way: number
  airport_taxi_per_leg: number
  full_coverage_cities: string[]
  coverage_percent: 100 | 75
}

/** PRD §8 — the 4 rate groups the 14 designations map onto (20260926000000_staff_phase0_policy.sql). */
export type GradeBandCode = 'B1' | 'B2' | 'B3' | 'B4'

export interface GradeBand {
  id: string
  code: GradeBandCode
  label: string
  dta_per_day_100: number
  dta_per_day_75: number
  local_running_per_day_100: number
  local_running_per_day_75: number
}

/** PRD §8 — confirmed exhaustive: exactly 14, mapped onto a grade_bands row. */
export interface Designation {
  id: string
  name: string
  grade_band_id: string
}

/**
 * One person on a memo, including the requester (`is_requester = true`).
 * PRD FR-5/FR-14/FR-17: designation and band rates are snapshotted at
 * add-time so a later Admin remap never rewrites a figure already shown or
 * queued; `is_unmapped` is FR-13's hard refusal, never a defaulted zero.
 */
export interface RequestTraveler {
  id: string
  request_id: string
  staff_id: string
  is_requester: boolean
  designation_name: string
  grade_band_code: GradeBandCode | null
  is_unmapped: boolean
  dta_rate_used: number | null
  local_running_rate_used: number | null
  dta_amount: number | null
  local_running_amount: number | null
  transport_amount: number
  airport_taxi_amount: number
  transport_override: number | null
  airport_taxi_override: number | null
  traveller_total: number | null
  created_at: string
}

/** A `request_travelers` row enriched with the traveller's display name — what the staff-side UI actually renders. */
export interface RequestTravelerWithName extends RequestTraveler {
  staff: Pick<Staff, 'first_name' | 'surname'> | null
}

export interface Approval {
  id: string
  request_id: string
  approver_id: string
  status: ApprovalStatus
  reason: string | null
  is_final: boolean
  timestamp: string
}

export interface AuthAuditLog {
  id: string
  email: string
  success: boolean | null
  ip_address: string | null
  timestamp: string
}

// ============================================================
// Insert Types (fields the client provides; DB defaults excluded)
// ============================================================
export type RateReferenceInsert = Omit<RateReference, 'id'>
export type DepartmentInsert = Omit<Department, 'id'>
export type LevelInsert = Omit<Level, 'id'>
export type StaffInsert = Omit<Staff, 'created_at'>

export type TravelRequestInsert = Omit<
  TravelRequest,
  'id' | 'submitted_at' | 'created_at' | 'updated_at'
>

export type ApprovalInsert = Omit<Approval, 'id' | 'timestamp'>

// ============================================================
// Joined / View Types (commonly needed in UI)
// ============================================================

/** Staff record with department and level names resolved */
export interface StaffWithDetails extends Staff {
  department: Department | null
  level: Level | null
}

/** Travel request with staff info for HR/MD review screens */
export interface TravelRequestWithStaff extends TravelRequest {
  staff: Pick<Staff, 'first_name' | 'surname' | 'email'> | null
  level: Pick<Level, 'name' | 'coverage_percent'> | null
  department: Pick<Department, 'name'> | null
}

/** One approval/rejection record as embedded in the MD queue/history queries */
export type ApprovalTrailEntry = Pick<Approval, 'status' | 'reason' | 'is_final' | 'timestamp'>

/**
 * Travel request shape returned by `getPendingMDRequests()` / `getMDHistory()`
 * — staff identity nested with department + level (coverage %), plus the
 * full approvals trail (used to surface HR's forwarding note and, in
 * history, the final decision reason). PRD Section 3.3.
 */
export interface TravelRequestForMD extends TravelRequest {
  staff: (Pick<Staff, 'first_name' | 'surname' | 'email'> & {
    department: Pick<Department, 'name'> | null
    level: Pick<Level, 'name' | 'coverage_percent'> | null
  }) | null
  approvals: ApprovalTrailEntry[] | null
  /** Null on pre-Phase-0 rows. Populated for a memo_number row (20260926000000_staff_phase0_policy.sql). */
  request_travelers: RequestTravelerWithName[] | null
}

/**
 * Travel request shape returned by `getPendingHRRequests()` — staff identity
 * nested with department + level (coverage %, needed for the live total),
 * plus two enrichments computed server-side so the review screen doesn't
 * need extra client round-trips: PRD Section 3.2's overlap flag and
 * resubmission context.
 */
export interface TravelRequestForHR extends TravelRequest {
  staff: (Pick<Staff, 'first_name' | 'surname' | 'email'> & {
    department: Pick<Department, 'name'> | null
    /** `flight_class` drives the cabin in the live-fare lookup link. */
    level: Pick<Level, 'id' | 'name' | 'coverage_percent' | 'flight_class'> | null
  }) | null
  /** Joined airports for the route key. Null when the city didn't resolve — see TravelRequest. */
  origin_airport: Pick<Airport, 'iata_code' | 'city'> | null
  destination_airport: Pick<Airport, 'iata_code' | 'city'> | null
  /** Other active (pending_hr/pending_md/approved) requests by the same staff member whose dates overlap this one. */
  overlaps: Pick<TravelRequest, 'id' | 'destination' | 'depart_date' | 'return_date'>[]
  /** Latest HR/MD rejection reason from the request this one supersedes, if it's a resubmission. */
  previousRejectionReason: string | null
  /** Null on pre-Phase-0 rows. Populated for a memo_number row — this is what ReviewCardV2 renders instead of the legacy allowance form. */
  request_travelers: RequestTravelerWithName[] | null
}

/** Result of `getRateSuggestionForRequest()` — mirrors the 4 promotable allowance fields (PRD 3.4). */
export interface RateSuggestionResult {
  accommodation: number | null
  per_diem: number | null
  allowance_flight: number | null
  allowance_taxi: number | null
  coveragePercent: number | null
  /** When the suggested flight_estimate was last touched — null if there's no flight price on file. */
  flightUpdatedAt: string | null
}

/** Rate override with the HR staff member's name resolved (Admin audit log) */
export interface RateOverrideWithStaff extends RateOverride {
  hr_staff: Pick<Staff, 'first_name' | 'surname'> | null
}

/** Rate reference with the level's name resolved (Admin Master Rate Table) */
export interface RateReferenceWithLevel extends RateReference {
  level: Pick<Level, 'name'> | null
}

/**
 * One row in the "add a colleague" traveller picker (FR-5). `designation`
 * is null when Admin hasn't mapped this person yet — the picker still lets
 * them be added (a trip isn't blocked on Admin data entry), it's the
 * calculator that then refuses to price that traveller (FR-13).
 */
export interface StaffDirectoryEntry {
  id: string
  first_name: string | null
  surname: string | null
  designation: string | null
  grade_band_code: GradeBandCode | null
}
