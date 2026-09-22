/**
 * Database types for the Nigcomsatravel application.
 *
 * These types mirror the Supabase schema defined in
 * supabase/migrations/20260731144738_initial_schema.sql and the grade-band /
 * request-travellers rework in 20260921130000_grade_bands.sql and
 * 20260921140000_request_travellers.sql (REVISED_SCOPE.md).
 *
 * TODO: Replace with auto-generated types via `supabase gen types typescript`
 * once the database is deployed and accessible.
 */

// ============================================================
// Enums
// ============================================================
/** Generic key/value config store. PRD Section 3.4. */
export interface AppSetting {
  key: string
  value: string
  updated_by: string | null
  updated_at: string
}

/** Roles assigned to staff members (PRD Section 2.2) */
export type UserRole = 'staff' | 'hr' | 'md' | 'admin'

/**
 * Travel request status lifecycle. MD approval moved to the ERP
 * (REVISED_SCOPE.md decision 5) — `queued_for_erp`/`in_erp` are the
 * ERP-outbox states Phase 4 will actually drive; in Phase 0 HR's forward
 * action lands a request in `queued_for_erp` and nothing moves it further
 * yet. `approved`/`rejected` are reserved for Phase 5's outcome polling.
 */
export type RequestStatus =
  | 'pending_hr'
  | 'hr_returned'
  | 'queued_for_erp'
  | 'in_erp'
  | 'approved'
  | 'rejected'
  | 'rejected_final'

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

/** Rate band — REVISED_SCOPE.md §3. Only the 100%-coverage rates are stored; 75% is derived from `CoverageTier.percent` at calculation time. */
export interface GradeBand {
  id: string
  code: string
  name: string
  dta_per_day: number
  local_running_per_day: number
  sort_order: number
}

export interface CoverageTier {
  code: string
  percent: number
}

/** Cities on the `full` coverage tier. Anything not listed defaults to `partial`. */
export interface DestinationCoverage {
  city: string
  coverage_tier_code: string
}

/** A real NIGCOMSAT designation, mapped onto exactly one grade band. */
export interface Level {
  id: string
  name: string
  band_id: string
  sort_order: number | null
}

export interface Staff {
  id: string
  email: string
  first_name: string | null
  surname: string | null
  role: UserRole
  department_id: string | null
  level_id: string | null
  active: boolean
  created_at: string
}

/** Domestic (within Nigeria) vs international — drives the destination dropdown grouping. */
export type RouteType = 'domestic' | 'international'

/**
 * Controlled vocabulary for trip endpoints (20260822160000_airports.sql).
 * `route_type` is a generated column derived from `country_code`, so it's
 * read-only and can't drift.
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

/** No longer a pricing input (REVISED_SCOPE.md M4) — survives only as HR's flight-price reference board. */
export interface RateReference {
  id: string
  destination: string
  level_id: string | null
  mode: string | null
  accommodation_rate: number | null
  per_diem_rate: number | null
  flight_estimate: number | null
  airport_taxi: number | null
  updated_at: string | null
  updated_by: string | null
}

/** One HR deviation from the calculator's policy-default transport/taxi figure, on one traveller's line. */
export interface RateOverride {
  id: string
  request_id: string
  traveller_id: string | null
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

/**
 * A memo's trip header — one row per memo, one row per traveller in
 * `request_travellers`. `staff_id` is the requester (the most senior staff
 * member on the trip), unchanged in meaning from before the travellers
 * split.
 */
export interface TravelRequest {
  id: string
  travel_group_id: string
  previous_version_id: string | null
  staff_id: string
  memo_number: string
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
  one_way: boolean
  /** Derived from dates: (return_date − depart_date) + 1, inclusive. */
  days_requested: number
  /** HR's override — null until reviewed. `days_approved ?? days_requested` is what the calculator uses. */
  days_approved: number | null
  reason_for_travel: string | null
  /** Band rates, coverage tier/percent, and policy defaults in force at submit — so a later Admin rate change doesn't rewrite history. */
  policy_snapshot: Record<string, unknown> | null
  coverage_percent_applied: number | null
  /** Sum of every traveller's total (request_travellers.traveller_total). */
  request_total: number | null
  status: RequestStatus
  submitted_at: string
  depart_date: string
  return_date: string
  created_at: string
  updated_at: string
}

/** One traveller's priced line on a memo. `grade_band_code` snapshots the band they were priced at. */
export interface RequestTraveller {
  id: string
  request_id: string
  staff_id: string
  grade_band_code: string
  dta: number
  local_running: number
  transport_cost: number
  airport_taxi: number
  traveller_total: number
  created_at: string
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

export type RequestTravellerInsert = Omit<RequestTraveller, 'id' | 'created_at'>

export type ApprovalInsert = Omit<Approval, 'id' | 'timestamp'>

// ============================================================
// Joined / View Types (commonly needed in UI)
// ============================================================

/** A level with its band's rates resolved — what the calculator needs to price a traveller. */
export interface LevelWithBand extends Level {
  band: Pick<GradeBand, 'code' | 'name' | 'dta_per_day' | 'local_running_per_day'> | null
}

/** Staff record with department and level (+ band) resolved */
export interface StaffWithDetails extends Staff {
  department: Department | null
  level: LevelWithBand | null
}

/** One approval/rejection record as embedded in the MD queue/history queries */
export type ApprovalTrailEntry = Pick<Approval, 'status' | 'reason' | 'is_final' | 'timestamp'>

/** A traveller line with the traveller's name resolved — what the HR/MD/staff UIs render. */
export interface RequestTravellerWithStaff extends RequestTraveller {
  staff: Pick<Staff, 'first_name' | 'surname' | 'email'> | null
}

/**
 * Travel request shape returned by `getPendingMDRequests()` / `getMDHistory()`
 * — staff identity nested with department, plus every traveller's priced
 * line and the full approvals trail (used to surface HR's forwarding note
 * and, in history, the final decision reason). PRD Section 3.3.
 */
export interface TravelRequestForMD extends TravelRequest {
  staff: (Pick<Staff, 'first_name' | 'surname' | 'email'> & {
    department: Pick<Department, 'name'> | null
  }) | null
  travellers: RequestTravellerWithStaff[]
  approvals: ApprovalTrailEntry[] | null
}

/**
 * Travel request shape returned by `getPendingHRRequests()` — staff identity
 * nested with department, every traveller's priced line, plus two
 * enrichments computed server-side so the review screen doesn't need extra
 * client round-trips: PRD Section 3.2's overlap flag and resubmission
 * context.
 */
export interface TravelRequestForHR extends TravelRequest {
  staff: (Pick<Staff, 'first_name' | 'surname' | 'email'> & {
    department: Pick<Department, 'name'> | null
  }) | null
  travellers: RequestTravellerWithStaff[]
  /** Joined airports for the route key. Null when the city didn't resolve — see TravelRequest. */
  origin_airport: Pick<Airport, 'iata_code' | 'city'> | null
  destination_airport: Pick<Airport, 'iata_code' | 'city'> | null
  /** Other active (pending_hr/queued_for_erp/approved) requests by the same staff member whose dates overlap this one. */
  overlaps: Pick<TravelRequest, 'id' | 'destination' | 'depart_date' | 'return_date'>[]
  /** Latest HR rejection reason from the request this one supersedes, if it's a resubmission. */
  previousRejectionReason: string | null
}

/** Rate override with the HR staff member's name resolved (Admin audit log) */
export interface RateOverrideWithStaff extends RateOverride {
  hr_staff: Pick<Staff, 'first_name' | 'surname'> | null
}

/** Rate reference with the level's name resolved (Admin flight-price reference board) */
export interface RateReferenceWithLevel extends RateReference {
  level: Pick<Level, 'name'> | null
}
