#!/usr/bin/env node
/**
 * Seed the "super user" test set — one account per role, for each real
 * inbox in BASES, using Gmail plus-addressing.
 *
 * Roles in this app are mutually exclusive (staff/hr/md/admin, one per
 * `staff` row — see the CHECK constraint in the initial schema), so there
 * is no single login that can see every screen. The workaround is one
 * account per role under `you+role@gmail.com`: Supabase treats each as a
 * distinct user, Gmail delivers every OTP to the same inbox, so one person
 * can walk the whole app by logging in and out of four accounts.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-superusers.mjs
 *   node --env-file=.env.local scripts/seed-superusers.mjs --dry-run
 *
 * Idempotent, and repairs rather than skips: an existing staff row gets its
 * role/department/level/active corrected to match the table below, and an
 * auth user that lost its staff row gets relinked instead of erroring.
 *
 * Requires (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

// ── Edit these two lists to change who gets a set ────────────────────────
const BASES = [
  { email: 'bashironimison@gmail.com', first_name: 'Bashir' },
  { email: 'cpdokoye7@gmail.com', first_name: 'Chidi' },
]

/**
 * One row per role. `level` drives what the request estimator can price:
 * Manager and General Manager are the levels with the widest seeded
 * rate_reference coverage (Lagos, Abuja, London, Dubai), so the staff and
 * HR testers sit there and "Suggest Standard Rates" has something to find.
 */
const ROLE_SET = [
  { role: 'staff', surname: 'Staff', department: 'Engineering',      level: 'Manager' },
  { role: 'hr',    surname: 'HR',    department: 'Human Resources',  level: 'Manager' },
  { role: 'md',    surname: 'MD',    department: 'Management',       level: 'Executive Director' },
  { role: 'admin', surname: 'Admin', department: 'System Admin Dept', level: 'Director' },
]
// ─────────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/seed-superusers.mjs')
  process.exit(1)
}

const admin = createClient(url, serviceKey)

/** `bashironimison@gmail.com` + `hr` → `bashironimison+hr@gmail.com`, lowercased. */
function plusAddress(base, tag) {
  const [local, domain] = base.toLowerCase().split('@')
  return `${local}+${tag}@${domain}`
}

/** listUsers() has no email filter, so page through it. Only run on the
 *  "already registered" path, where we need the existing id to relink. */
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  const { data: departments, error: deptError } = await admin.from('departments').select('id, name')
  const { data: levels, error: levelError } = await admin.from('levels').select('id, name')

  if (deptError || levelError) {
    console.error(`Could not read departments/levels — ${(deptError ?? levelError).message}`)
    console.error('Run the migrations first (supabase/migrations).')
    process.exit(1)
  }

  const accounts = BASES.flatMap((base) =>
    ROLE_SET.map((r) => ({
      ...r,
      email: plusAddress(base.email, r.role),
      first_name: base.first_name,
      inbox: base.email.toLowerCase(),
    }))
  )

  if (DRY_RUN) {
    console.log('Dry run — nothing will be written.\n')
    console.table(accounts.map(({ email, role, department, level, inbox }) => ({ email, role, department, level, inbox })))
    return
  }

  let created = 0
  let repaired = 0
  let failed = 0

  for (const person of accounts) {
    const dept = departments.find((d) => d.name === person.department)
    const level = levels.find((l) => l.name === person.level)

    if (!dept || !level) {
      console.error(`✗ ${person.email}: department "${person.department}" or level "${person.level}" not found — skipping.`)
      failed++
      continue
    }

    const row = {
      email: person.email,
      first_name: person.first_name,
      surname: person.surname,
      role: person.role,
      department_id: dept.id,
      level_id: level.id,
      active: true,
    }

    // Existing staff row: bring it back in line with the table above
    // (role changed by hand, deactivated by an earlier test pass, etc.).
    const { data: existing } = await admin.from('staff').select('id, role, active').eq('email', person.email).maybeSingle()

    if (existing) {
      const { error } = await admin.from('staff').update(row).eq('id', existing.id)
      if (error) {
        console.error(`✗ ${person.email}: update failed — ${error.message}`)
        failed++
        continue
      }
      const changed = existing.role !== person.role || existing.active !== true
      console.log(`${changed ? '↻' : '•'} ${person.email} (${person.role}) — ${changed ? 'corrected' : 'already correct'}`)
      repaired++
      continue
    }

    // email_confirm: OTP login does its own verification, so there is no
    // confirmation link for anyone to click.
    let { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    })

    if (createError) {
      // Auth user exists but has no staff row — relink rather than fail.
      const orphan = await findAuthUserByEmail(person.email)
      if (!orphan) {
        console.error(`✗ ${person.email}: could not create auth user — ${createError.message}`)
        failed++
        continue
      }
      authUser = { user: orphan }
      console.log(`  ${person.email}: auth user already existed, relinking staff row`)
    }

    const { error: insertError } = await admin.from('staff').insert({ id: authUser.user.id, ...row })

    if (insertError) {
      console.error(`✗ ${person.email}: auth user ready but staff row failed — ${insertError.message}`)
      failed++
      continue
    }

    console.log(`✓ ${person.email} (${person.role}, ${person.level})`)
    created++
  }

  console.log(`\n${created} created, ${repaired} already present, ${failed} failed.`)
  console.log('Log in at /login with any address above — the OTP lands in the base inbox.')
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
