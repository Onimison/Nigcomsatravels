# NIGCOMSAT Travel Request Tool

A self-service web application for managing staff travel requests at NIGCOMSAT. Staff submit travel requests, HR reviews and applies company policy (allowances), and the MD provides final approval.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, TypeScript)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend:** [Supabase](https://supabase.com/) (Auth, Postgres, RLS)
- **Validation:** [Zod](https://zod.dev/)
- **Linting:** ESLint

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (get credentials from your team lead)

### Setup

```bash
# Clone the repository
git clone https://github.com/Onimison/Nigcomsatravel.git
cd Nigcomsatravel

# Install dependencies
npm install

# Set up environment variables
cp env.example .env.local
# Edit .env.local with your Supabase credentials

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Available Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── (auth)/          # Login & OTP verification
│   ├── (dashboard)/     # Role-based dashboards (staff, hr, md, admin)
│   └── api/webhooks/    # External integration endpoints only
├── components/          # React components (ui, forms, shared)
├── hooks/               # Custom React hooks
├── lib/
│   ├── actions/         # Server Actions (business logic)
│   ├── supabase/        # Supabase client configuration
│   ├── utils/           # Helpers and constants
│   └── validations/     # Zod validation schemas
├── types/               # TypeScript type definitions
└── proxy.ts             # Auth session management
```

## User Roles

| Role | Dashboard | Capabilities |
|:---|:---|:---|
| **Staff** | `/staff` | Submit travel requests, view history |
| **HR** | `/hr` | Review requests, set allowances, approve/reject |
| **MD** | `/md` | Final approval authority |
| **Admin** | `/admin` | Manage staff, levels, rates, departments |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit format, and PR workflow.

## Documentation

- **Product Requirements:** `notes.md`
- **Database Schema:** `supabase/migrations/`
- **Environment Variables:** `env.example`
