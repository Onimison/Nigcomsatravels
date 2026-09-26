import 'server-only'

/**
 * Shared trip-endpoint resolution — extracted from requests.actions.ts so it
 * can also be used by travel-requests-v2.actions.ts (the Phase 0
 * memo-number/multi-traveller submit path) without either module importing
 * the other. Deliberately NOT inside a 'use server' file: it takes a
 * Supabase client as its first argument, which can't cross the server
 * action RPC boundary, so it lives as a plain server-only helper instead.
 */

import type { createClient } from '@/lib/supabase/server'

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Turns one end of a trip into a (canonical text, airport FK) pair.
 *
 * The airport id is re-read server-side rather than trusted alongside the
 * client's text, so a tampered or stale form can't file a request whose
 * `destination` says one city and whose `destination_airport_id` points at
 * another — the text always comes from the row the FK names.
 *
 * Falls back to an exact case-insensitive match on the typed text, which is
 * what lets a request submitted through the "Other — not listed" escape
 * hatch still pick up a route key when the city does happen to be seeded.
 * A miss is not an error: the FK stays null and downstream degrades.
 */
export async function resolveEndpoint(
  supabase: SupabaseClient,
  airportId: string | null | undefined,
  text: string
): Promise<{ text: string; airportId: string | null }> {
  if (airportId) {
    const { data } = await supabase.from('airports').select('id, city').eq('id', airportId).maybeSingle()
    if (data) return { text: data.city, airportId: data.id }
  }

  const trimmed = text.trim()
  if (trimmed) {
    // No wildcards — ilike here is an exact match that ignores case.
    const { data } = await supabase.from('airports').select('id, city').ilike('city', trimmed).limit(1).maybeSingle()
    if (data) return { text: data.city, airportId: data.id }
  }

  return { text: trimmed, airportId: null }
}
