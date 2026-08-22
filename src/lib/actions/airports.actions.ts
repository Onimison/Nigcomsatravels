'use server'

/**
 * Airports reference reads (20260822160000_airports.sql).
 *
 * Read-only by design: the table is Admin-writable via RLS, but nothing in
 * the app writes it yet — new airports go in through a migration so the seed
 * stays the single description of the controlled vocabulary.
 */

import { createClient } from '@/lib/supabase/server'
import type { AirportOption } from '@/types/database'

/**
 * Active airports for the request-form dropdown, ordered domestic-first then
 * alphabetically — which is also the order the two `<optgroup>`s render in.
 */
export async function listAirports() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('airports')
    .select('id, iata_code, city, route_type')
    .eq('active', true)
    .order('route_type', { ascending: true })
    .order('city', { ascending: true })

  if (error) return { success: false, error: error.message, data: [] as AirportOption[] }
  return { success: true, data: (data ?? []) as AirportOption[] }
}
