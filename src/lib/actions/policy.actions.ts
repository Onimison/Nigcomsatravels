'use server'

/**
 * Read-only lookups for the Phase 0 travel-policy calculator
 * (20260926000000_staff_phase0_policy.sql) — grade bands, the flat policy
 * defaults, and the staff directory the traveller picker searches (FR-5).
 *
 * All fetched once per page load and handed to the client form as props,
 * not re-queried per keystroke — the live cost preview is a pure,
 * synchronous calculation (NFR Performance).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/auth-guard'
import { revalidatePath } from 'next/cache'
import { POLICY_SETTING_KEYS } from '@/lib/utils/constants'
import type { PolicyDefaults } from '@/lib/utils/policy-calculator'
import {
  updateGradeBandSchema,
  updateDesignationBandSchema,
  updatePolicyDefaultsSchema,
  type UpdateGradeBandInput,
  type UpdateDesignationBandInput,
  type UpdatePolicyDefaultsInput,
} from '@/lib/validations/policy-admin.schema'
import type { Designation, GradeBand, StaffDirectoryEntry } from '@/types/database'

export interface ActionResult {
  success: boolean
  error?: string
}

export async function listGradeBands(): Promise<{ success: boolean; error?: string; data: GradeBand[] }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('grade_bands').select('*').order('code', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }
  return { success: true, data: (data ?? []) as GradeBand[] }
}

const POLICY_DEFAULT_FALLBACK: PolicyDefaults = {
  transportAirEachWay: 150000,
  transportRoadEachWay: 50000,
  airportTaxiPerLeg: 40000,
  fullCoverageCities: ['Lagos', 'Abuja', 'Port Harcourt'],
}

/**
 * §8's flat defaults, read from app_settings. Falls back to the PRD's
 * documented values if a key is ever missing (e.g. a database that hasn't
 * run the seed insert) — never silently prices at zero.
 */
export async function getPolicyDefaults(): Promise<{ success: boolean; data: PolicyDefaults }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', Object.values(POLICY_SETTING_KEYS))

  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]))
  const num = (key: string, fallback: number) => {
    const raw = byKey.get(key)
    const parsed = raw != null ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const citiesRaw = byKey.get(POLICY_SETTING_KEYS.fullCoverageCities)
  const fullCoverageCities = citiesRaw
    ? String(citiesRaw).split(',').map((c: string) => c.trim()).filter(Boolean)
    : POLICY_DEFAULT_FALLBACK.fullCoverageCities

  return {
    success: true,
    data: {
      transportAirEachWay: num(POLICY_SETTING_KEYS.transportAirEachWay, POLICY_DEFAULT_FALLBACK.transportAirEachWay),
      transportRoadEachWay: num(POLICY_SETTING_KEYS.transportRoadEachWay, POLICY_DEFAULT_FALLBACK.transportRoadEachWay),
      airportTaxiPerLeg: num(POLICY_SETTING_KEYS.airportTaxiPerLeg, POLICY_DEFAULT_FALLBACK.airportTaxiPerLeg),
      fullCoverageCities,
    },
  }
}

/**
 * The active staff directory for the "add a colleague" picker (FR-5),
 * joined out to each person's grade band. `grade_band_code`/`designation`
 * come back null for anyone Admin hasn't mapped yet — the picker still
 * lists them (adding someone to a trip isn't blocked on Admin data entry),
 * the calculator is what refuses to price them (FR-13).
 */
export async function listStaffDirectory(): Promise<{
  success: boolean
  error?: string
  data: StaffDirectoryEntry[]
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('staff')
    .select(
      `id, first_name, surname,
       designation:designations(name, grade_band:grade_bands(code))`
    )
    .eq('active', true)
    .order('first_name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }

  const entries: StaffDirectoryEntry[] = (data ?? []).map((row) => {
    const designation = Array.isArray(row.designation) ? row.designation[0] : row.designation
    const gradeBand = designation
      ? Array.isArray(designation.grade_band)
        ? designation.grade_band[0]
        : designation.grade_band
      : null
    return {
      id: row.id,
      first_name: row.first_name,
      surname: row.surname,
      designation: designation?.name ?? null,
      grade_band_code: gradeBand?.code ?? null,
    }
  })

  return { success: true, data: entries }
}

/** The signed-in user's own grade band, for auto-adding them as the first traveller. */
export async function getMyGradeBand(): Promise<{
  success: boolean
  error?: string
  data: { designation: string | null; gradeBand: GradeBand | null }
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated', data: { designation: null, gradeBand: null } }

  const { data, error } = await supabase
    .from('staff')
    .select('designation:designations(name, grade_band:grade_bands(*))')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return { success: false, error: error?.message, data: { designation: null, gradeBand: null } }
  }

  const designation = Array.isArray(data.designation) ? data.designation[0] : data.designation
  const gradeBand = designation
    ? ((Array.isArray(designation.grade_band) ? designation.grade_band[0] : designation.grade_band) as GradeBand)
    : null

  return {
    success: true,
    data: { designation: designation?.name ?? null, gradeBand: gradeBand ?? null },
  }
}

// ============================================================
// Admin: grade bands, designation mapping, policy defaults (FR-23/FR-24)
// ============================================================

/** All 14 designations with their current band — the mapping table Admin edits (FR-24), and the dropdown staff-management.tsx uses to assign a person's designation. */
export async function listDesignations(): Promise<{
  success: boolean
  error?: string
  data: (Designation & { grade_band: Pick<GradeBand, 'code' | 'label'> | null })[]
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('designations')
    .select('*, grade_band:grade_bands(code, label)')
    .order('name', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] }

  const rows = (data ?? []).map((row) => ({
    ...row,
    grade_band: Array.isArray(row.grade_band) ? row.grade_band[0] : row.grade_band,
  }))

  return { success: true, data: rows as (Designation & { grade_band: Pick<GradeBand, 'code' | 'label'> | null })[] }
}

/** FR-23: grade-band DTA/local-running rates — no deployment required. */
export async function updateGradeBand(input: UpdateGradeBandInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateGradeBandSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { id, ...fields } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from('grade_bands').update(fields).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

/** FR-24: which designation maps to which band. The 14 designations themselves are confirmed exhaustive and not editable here. */
export async function updateDesignationBand(input: UpdateDesignationBandInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updateDesignationBandSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('designations')
    .update({ grade_band_id: parsed.data.grade_band_id })
    .eq('id', parsed.data.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

/** FR-23: the three flat policy defaults + the 100%-coverage city list, stored in app_settings alongside the FX rate. */
export async function updatePolicyDefaults(input: UpdatePolicyDefaultsInput): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.authorized) return { success: false, error: auth.error }

  const parsed = updatePolicyDefaultsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rows = [
    { key: POLICY_SETTING_KEYS.transportAirEachWay, value: String(parsed.data.transport_air_each_way) },
    { key: POLICY_SETTING_KEYS.transportRoadEachWay, value: String(parsed.data.transport_road_each_way) },
    { key: POLICY_SETTING_KEYS.airportTaxiPerLeg, value: String(parsed.data.airport_taxi_per_leg) },
    { key: POLICY_SETTING_KEYS.fullCoverageCities, value: parsed.data.full_coverage_cities.join(',') },
  ].map((row) => ({ ...row, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }))

  const { error } = await supabase.from('app_settings').upsert(rows)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin')
  return { success: true }
}
