# Contributing to NIGCOMSAT Travel Request Tool

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/Onimison/Nigcomsatravel.git
   cd Nigcomsatravel
   npm install
   ```

2. Set up your environment variables:
   ```bash
   cp env.example .env.local
   ```
   Fill in the Supabase URL, Anon Key, and Service Role Key. Ask your team lead for these values.

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Branch Naming Convention

Use the following format:

```
<type>/sprint-<number>/<short-description>
```

**Examples:**
- `feature/sprint-0/admin-staff-crud`
- `feature/sprint-1/login-page`
- `fix/sprint-2/hr-review-total-calc`
- `docs/update-readme`

**Types:**
| Type | When to use |
|:---|:---|
| `feature` | New functionality |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |

---

## Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Examples:**
- `feat(admin): add staff CRUD actions`
- `fix(auth): handle expired OTP gracefully`
- `refactor(requests): extract cost calculation to utility`
- `docs(readme): add setup instructions`

**Scopes:** `auth`, `staff`, `hr`, `md`, `admin`, `requests`, `rates`, `db`

---

## Pull Request Workflow

1. **Create a branch** from `main` using the naming convention above.
2. **Make your changes.** Reference the PRD section in your code comments.
3. **Run checks locally** before pushing:
   ```bash
   npm run lint
   npm run build
   ```
4. **Push your branch** and open a PR against `main`.
5. **Fill out the PR template** completely (especially the PRD Section field).
6. **Wait for review.** At least 1 approval is required before merging.
7. **Squash and merge** (GitHub will prompt this).

---

## Key Rules

### ⚠️ Never Do These

- **Never push directly to `main`.** Always use a PR.
- **Never commit `.env.local`.** It contains secrets. Use `env.example` as a reference.
- **Never import `@/lib/supabase/admin` in a client component.** The `server-only` package will break the build if you try, but don't try.
- **Never edit a rejected travel request row.** Create a new row with the same `travel_group_id` (see PRD Section 5.3).

### ✅ Always Do These

- **Reference the PRD.** Every feature maps to a section. Mention it in your PR and code comments.
- **Use Zod schemas** for validation. They live in `src/lib/validations/`. Use them in both Server Actions and forms.
- **Use Server Actions** (files in `src/lib/actions/`) for all data mutations. Do NOT create API routes for internal UI logic.
- **Run `npm run lint && npm run build`** before pushing. CI will catch it anyway, but save yourself the round-trip.

---

## Project Structure Quick Reference

```
src/
├── app/
│   ├── (auth)/          # Login, OTP verification (unauthenticated)
│   ├── (dashboard)/     # Staff, HR, MD, Admin pages (authenticated)
│   └── api/webhooks/    # ONLY for external integrations
├── components/
│   ├── ui/              # Reusable primitives (Button, Card, Input)
│   ├── forms/           # Domain forms (TravelRequestForm, HRReviewForm)
│   └── shared/          # Layout components (Sidebar, Navbar)
├── hooks/               # Custom React hooks (useAuth, useOverlapWarning)
├── lib/
│   ├── actions/         # Server Actions (auth, staff, requests, rates)
│   ├── supabase/        # Supabase client configs (client, server, admin)
│   ├── utils/           # Helpers (formatting, constants)
│   └── validations/     # Zod schemas (request, staff)
├── types/               # TypeScript type definitions
└── proxy.ts             # Route-level auth/session management
```

---

## Need Help?

- **PRD:** `notes.md` in the project root
- **Database Schema:** `supabase/migrations/20260731144738_initial_schema.sql`
- **Type Definitions:** `src/types/database.ts`
- **Status Labels:** `src/lib/utils/constants.ts`
