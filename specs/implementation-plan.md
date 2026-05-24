# Implementation Plan — Titra

**Version:** 0.1
**Last updated:** 2026-05-24

---

## Database Decision

**Chosen: PostgreSQL + Prisma ORM**

Rationale:
- Financial data demands ACID transactions — PostgreSQL is the gold standard.
- Prisma gives type-safe queries that align perfectly with TypeScript strict mode.
- VND has no decimal places, so integer storage is sufficient and avoids floating-point errors.
- PostgreSQL's JSONB is available if flexible metadata is ever needed.
- Excellent ecosystem: PgBouncer for pooling, Neon/Supabase for managed hosting.
- Alternatives considered: MySQL (weaker constraints), MongoDB (no ACID for financial writes), SQLite (not production-suitable for multi-user).

Managed hosting recommendation: **Neon** (serverless Postgres, generous free tier, branching support for dev/prod separation).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser / PWA                 │
│         Next.js 14 (App Router) + shadcn/ui     │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS / WebSocket
┌──────────────────▼──────────────────────────────┐
│              NestJS REST API                    │
│         /api/v1/*  +  Socket.io gateway         │
└────────┬─────────────────────┬──────────────────┘
         │                     │
┌────────▼────────┐   ┌────────▼────────┐
│   PostgreSQL    │   │   Cloudinary    │
│   (via Prisma)  │   │  (file uploads) │
└─────────────────┘   └─────────────────┘
         │
┌────────▼────────┐
│     Resend      │
│  (email / PDF)  │
└─────────────────┘
```

---

## Monorepo Structure

```
titra/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   │   ├── app/                # App Router pages
│   │   │   ├── (auth)/         # Login, register, forgot-password
│   │   │   ├── (app)/          # Authenticated app shell
│   │   │   │   ├── dashboard/  # User home: list of events
│   │   │   │   ├── events/
│   │   │   │   │   ├── new/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── expenses/
│   │   │   │   │       ├── balances/
│   │   │   │   │       ├── settlements/
│   │   │   │   │       └── chat/
│   │   │   │   └── admin/      # Admin dashboard (role-guarded)
│   │   ├── components/
│   │   │   ├── ui/             # shadcn components (auto-generated)
│   │   │   └── features/       # Domain-specific components
│   │   ├── lib/                # API client, utils, hooks
│   │   └── styles/
│   │
│   └── api/                    # NestJS backend
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── events/
│           ├── expenses/
│           ├── settlements/
│           ├── messages/
│           ├── notifications/
│           ├── export/
│           ├── admin/
│           └── prisma/         # Prisma service + schema
│
├── packages/
│   └── shared/                 # Zod schemas, shared types
│
├── specs/
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## Phase Plan

### Phase 0 — Project Scaffolding
**Goal:** Runnable skeleton, CI, and database connected.

- [ ] Init pnpm monorepo + Turborepo
- [ ] Scaffold Next.js 14 app with TailwindCSS + shadcn/ui
- [ ] Scaffold NestJS app
- [ ] Set up Prisma with PostgreSQL, write initial schema
- [ ] Set up ESLint + Prettier + TypeScript strict across all packages
- [ ] Configure `.env.example` with all required variables
- [ ] GitHub Actions: lint + typecheck + test on PR

### Phase 1 — Auth & User Management
**Goal:** Users can register, log in, and manage their profile.

- [ ] NestJS: AuthModule (register, login, refresh, logout)
- [ ] NestJS: UsersModule (profile CRUD)
- [ ] Prisma migration: User table
- [ ] Next.js: Register page, Login page, Forgot Password page
- [ ] Next.js: Auth state via NextAuth or custom JWT handling
- [ ] Email verification flow (Resend)
- [ ] Protected route middleware (frontend + backend)

### Phase 2 — Events & Members
**Goal:** Organizers can create events and invite members.

- [ ] NestJS: EventsModule (CRUD, status transitions)
- [ ] NestJS: EventMembersModule (invite link, join, remove)
- [ ] Prisma migrations: Event, EventMember tables
- [ ] Next.js: Dashboard (list events), Create Event form
- [ ] Next.js: Event detail shell with tab navigation
- [ ] Next.js: Invite link page `/join/[token]`
- [ ] Next.js: Members management tab

### Phase 3 — Expenses
**Goal:** Members can log and split expenses.

- [ ] NestJS: ExpensesModule (CRUD, split calculation)
- [ ] Prisma migration: Expense, ExpenseSplit tables
- [ ] Balance calculation service (debt simplification algorithm)
- [ ] Next.js: Add Expense form (equal + custom split UI)
- [ ] Next.js: Expense list page
- [ ] Next.js: Balances tab (summary + transaction list)
- [ ] File upload to Cloudinary (receipt photos)

### Phase 4 — Settlements & Reminders
**Goal:** Debts can be settled and members reminded.

- [ ] NestJS: SettlementsModule (create, confirm)
- [ ] Prisma migration: Settlement table
- [ ] MoMo / VNPay deep-link generation
- [ ] Next.js: Settlements tab (log payment, confirm payment)
- [ ] NestJS: NotificationsModule (email reminders via Resend)
- [ ] Next.js: Send reminder UI (organizer only)

### Phase 5 — Chat & PDF Export
**Goal:** Members can communicate and export a final report.

- [ ] NestJS: MessagesModule + Socket.io gateway
- [ ] Prisma migration: Message table
- [ ] Next.js: Chat tab with real-time updates
- [ ] NestJS: ExportModule (PDF generation via @react-pdf/renderer or Puppeteer)
- [ ] Next.js: Export PDF button on event settings

### Phase 6 — Admin Dashboard
**Goal:** Admins can manage the system.

- [ ] NestJS: AdminModule (user list, event list, metrics)
- [ ] Role guard for ADMIN role
- [ ] Next.js: Admin dashboard pages (users, events, stats)

### Phase 7 — Polish & Launch
**Goal:** Production-ready quality.

- [ ] Responsive audit (375px → 1440px)
- [ ] i18n setup for all UI strings (Vietnamese)
- [ ] Error handling and loading states across all pages
- [ ] Rate limiting on API (nestjs-throttler)
- [ ] Helmet, CORS, CSP headers
- [ ] Performance pass (image optimization, lazy loading)
- [ ] End-to-end tests (Playwright)
- [ ] Deploy: Vercel (web) + Railway/Fly.io (api) + Neon (db)

---

## Key Technical Decisions

### Balance Calculation Algorithm
Use the "minimum cash flow" algorithm:
1. For each member, compute net balance = (sum paid) − (sum owed).
2. Separate into creditors (positive) and debtors (negative).
3. Greedily match the largest debtor with the largest creditor.
4. Result: minimized number of transactions.

This runs in O(n log n) and is sufficient for groups of ≤ 50 members.

### Split Rounding
When splitting equally among n members, remainder VND goes to the first member in the list. This is deterministic and transparent.

### Real-time Chat
Use Socket.io with NestJS gateway. Fallback: 5-second polling for environments where WebSocket is blocked. No persistence of presence/typing indicators in MVP.

### PDF Generation
Generate PDFs server-side using `@react-pdf/renderer` inside a NestJS service. Avoid Puppeteer in MVP to reduce container size and cold start time.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host/titra

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# File uploads
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# App
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Dependency List (planned)

### apps/web
- `next`, `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/forms`
- `shadcn/ui` components (as needed)
- `@tanstack/react-query`
- `react-hook-form`, `zod`, `@hookform/resolvers`
- `zustand`
- `socket.io-client`
- `next-auth` (or `jose` for manual JWT)
- `lucide-react` (icons, included with shadcn)

### apps/api
- `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`
- `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `passport-local`
- `@nestjs/websockets`, `@nestjs/platform-socket.io`
- `@nestjs/throttler`
- `@prisma/client`, `prisma`
- `class-validator`, `class-transformer`
- `resend`
- `cloudinary`
- `@react-pdf/renderer`
- `helmet`, `compression`

### packages/shared
- `zod`
