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
  active: boolean
  created_at: string
}

export interface RateReference {
  id: string
  destination: string
  level_id: string | null
  mode: string | null
  accommodation_rate: number | null
  per_diem_rate: number | null
  flight_estimate: number | null
  airport_taxi: number | null
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
