#!/usr/bin/env node
/**
 * Seed the internal test roster (5 staff/interns + 1 HR + 1 MD) — see
 * TESTING_SETUP.md for the full plan. Placeholder emails below: swap the
 * `email` field for each person's real address before running this against
 * anything other than a throwaway/dev Supabase project.
 *
 * Idempotent: re-running skips anyone whose email already has a staff row.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-test-accounts.mjs
 *
 * Requires (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * — same admin client used by src/lib/actions/staff.actions.ts, just invoked
 * directly instead of through the Admin UI's "Add Staff" form (which does
 * the exact same two writes — auth user + staff row — one at a time).
 */

import { createClient } from '@supabase/supabase-js'

// ── Edit this roster before running ──────────────────────────────────────
// department/level are matched by *name* below against whatever's already
// seeded (TRAVEL_POLICY_DEMO.md) — change them per person as needed.
const ROSTER = [
  { first_name: 'Intern', surname: 'One', email: 'bashironimison@gmail.com', role: 'staff', department: 'Engineering', level: 'Junior Staff' },
  { first_name: 'Test', surname: 'Staff', email: 'unnazitere@gmail.com', role: 'staff', department: 'Engineering', level: 'Junior Staff' },
  { first_name: 'Test', surname: 'HR', email: 'borisrael.ng@gmail.com', role: 'hr', department: 'Human Resources', level: 'Manager' },
  { first_name: 'Test', surname: 'MD', email: 'cpdokoye7@gmail.com', role: 'md', department: 'Management', level: 'Executive Director' },
  { first_name: 'HR', surname: 'Backup', email: 'godblessbashir@gmail.com', role: 'hr', department: 'Human Resources', level: 'Manager' },
]
// ──────────────────────────────────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/seed-test-accounts.mjs')
  process.exit(1)
}

if (ROSTER.some((p) => p.email.endsWith('@nigcomsat.example'))) {
  console.warn(
    '⚠️  Some emails are still placeholders (@nigcomsat.example) — nobody can log in with those.\n' +
    '    Edit the ROSTER array in this script with real addresses before this is useful for actual testing.\n'
  )
}

const admin = createClient(url, serviceKey)

async function main() {
  const { data: departments } = await admin.from('departments').select('id, name')
  const { data: levels } = await admin.from('levels').select('id, name')

  for (const person of ROSTER) {
    const dept = departments?.find((d) => d.name === person.department)
    const level = levels?.find((l) => l.name === person.level)

    if (!dept || !level) {
      console.error(`✗ ${person.email}: department "${person.department}" or level "${person.level}" not found — skipping. Run the migrations/seed first.`)
      continue
    }

    const { data: existing } = await admin.from('staff').select('id').eq('email', person.email).maybeSingle()
    if (existing) {
      console.log(`• ${person.email}: already exists, skipping`)
      continue
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: person.email,
      email_confirm: true, // OTP login handles verification, no confirmation link needed
    })

    if (createError || !created.user) {
      console.error(`✗ ${person.email}: could not create auth user — ${createError?.message}`)
      continue
    }

    const { error: insertError } = await admin.from('staff').insert({
      id: created.user.id,
      email: person.email,
      first_name: person.first_name,
      surname: person.surname,
      role: person.role,
      department_id: dept.id,
      level_id: level.id,
      active: true,
    })

    if (insertError) {
      console.error(`✗ ${person.email}: auth user created but staff row failed — ${insertError.message}`)
      await admin.auth.admin.deleteUser(created.user.id)
      continue
    }

    console.log(`✓ ${person.email} (${person.role}, ${person.level})`)
  }
}

main().then(() => console.log('Done.'))
