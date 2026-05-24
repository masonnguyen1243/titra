# Implementation Plan — Titra

**Version:** 0.2
**Last updated:** 2026-05-24

---

## Database Decision

**Chosen: PostgreSQL + Prisma ORM**

Rationale:
- Financial data requires ACID transactions — PostgreSQL is the standard choice.
- Prisma gives type-safe queries that align with TypeScript strict mode.
- VND has no decimal places; integer storage avoids all floating-point errors.
- Managed hosting: **Neon** (serverless Postgres, free tier, dev/prod branching).

Alternatives considered: MySQL (weaker constraints), MongoDB (no ACID for financial writes), SQLite (not suitable for multi-user production).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Browser / PWA                 │
│         Next.js 15 (App Router) + shadcn/ui     │
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
│   ├── web/                          # Next.js 15 frontend
│   │   ├── app/
│   │   │   ├── (auth)/               # login, register, forgot-password
│   │   │   ├── (app)/                # authenticated shell
│   │   │   │   ├── dashboard/        # event list
│   │   │   │   ├── events/
│   │   │   │   │   ├── new/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── expenses/
│   │   │   │   │       ├── balances/
│   │   │   │   │       ├── settlements/
│   │   │   │   │       └── chat/
│   │   │   │   └── admin/
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn (auto-generated)
│   │   │   └── features/             # domain components
│   │   └── lib/                      # API client, hooks, utils
│   │
│   └── api/                          # NestJS backend
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
│           └── prisma/
│
├── packages/
│   └── shared/                       # Zod schemas, shared types
│
├── specs/
├── .env.example
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Key Technical Decisions

### Balance Calculation Algorithm
Use the "minimum cash flow" algorithm:
1. Compute each member's net balance = (total paid) − (total owed).
2. Split into creditors (positive) and debtors (negative).
3. Greedily match the largest debtor with the largest creditor until all balances are zero.
4. Result: minimum number of transactions needed to settle the group.

Runs in O(n log n); sufficient for groups up to 50 members.

### Split Rounding
When splitting equally and the amount is not divisible by n, the remainder goes to the first member in the list. This is deterministic and shown transparently in the UI.

### Real-time Chat
Socket.io with NestJS gateway. Falls back to 5-second polling when WebSocket is blocked. No typing indicators or presence in MVP.

### PDF Generation
Generated server-side with `@react-pdf/renderer` inside the NestJS export module. Puppeteer is avoided to keep the container small and cold starts fast.

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

# App URLs
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Phase Plan

### Phase 1 — Project Setup
**Goal:** Empty repo → fully runnable skeleton with linting, types, and DB connected.

**Monorepo & tooling**
- [x] Init pnpm workspace + Turborepo
- [x] Configure `turbo.json` with `dev`, `build`, `lint`, `typecheck` pipelines
- [x] Add root `package.json` scripts that delegate to Turborepo
- [x] Set up ESLint + Prettier with shared config across all packages
- [x] Enable TypeScript strict mode in all `tsconfig.json` files

**Frontend skeleton**
- [x] Scaffold `apps/web` with Next.js 15 (App Router)
- [x] Install and configure TailwindCSS
- [x] Install shadcn/ui, add base components: Button, Input, Card, Dialog, Tabs, Toast
- [x] Create app shell layout with sidebar and header placeholder
- [x] Add route groups: `(auth)` and `(app)`

**Backend skeleton**
- [x] Scaffold `apps/api` with NestJS
- [x] Configure global prefix `/api/v1`
- [x] Add `helmet`, `compression`, and CORS middleware
- [x] Add `nestjs-throttler` for rate limiting
- [x] Add health-check endpoint `GET /api/v1/health`

**Database**
- [x] Add Prisma to `apps/api`, connect to PostgreSQL (Neon)
- [x] Write full initial schema: User, Event, EventMember, Expense, ExpenseSplit, Settlement, Message
- [ ] Run first migration, confirm connection works ← requires DATABASE_URL

**Shared package**
- [x] Scaffold `packages/shared` with Zod
- [x] Add base Zod schemas matching the DB schema (used later for validation)

**Config & CI**
- [x] Create `.env.example` with all required variables
- [x] Add `.env` to `.gitignore`
- [x] Add GitHub Actions workflow: lint + typecheck + unit tests on every push

---

### Phase 2 — Core UI
**Goal:** All screens built with static/hardcoded data. No real API calls yet. Focus on layout, navigation, and user experience.

**Auth screens**
- [ ] Login page (email + password form, Google OAuth button)
- [ ] Register page (name, email, password)
- [ ] Forgot password page (email input)
- [ ] Email sent confirmation screen

**Dashboard**
- [ ] Event list page (cards showing event name, type, member count, status)
- [ ] Empty state: "Bạn chưa có chuyến đi nào" with Create button
- [ ] Create event form (name, type, description, cover photo upload)

**Event detail**
- [ ] Event shell with tab navigation: Expenses · Balances · Settlements · Chat · Members
- [ ] Expenses tab: list of expenses with payer, amount, description, category chip
- [ ] Add Expense form:
  - [ ] Equal split mode (member checkboxes, per-person amount shown live)
  - [ ] Custom split mode (amount input per member, running total shown)
  - [ ] Receipt photo upload field
- [ ] Balances tab: net position per member + simplified "X owes Y: Z ₫" list
- [ ] Settlements tab: list of settlements with status badges (PENDING / CONFIRMED)
- [ ] Record Settlement form (select payer, amount, method, upload proof)
- [ ] Chat tab: message list + text input
- [ ] Members tab: member list with role badge + Remove button (organizer only)
- [ ] Invite link display with Copy button

**Admin dashboard**
- [ ] Stats cards: total users, total events, total VND tracked
- [ ] User table: email, role, status, registered date, Deactivate button
- [ ] Event table: name, organizer, status, member count, Archive button

**Shared components**
- [ ] Loading skeleton component (used across all data-heavy pages)
- [ ] Empty state component (reusable with custom icon + message)
- [ ] Avatar component (initials fallback if no photo)
- [ ] Currency display component (formats integers as "150.000 ₫")
- [ ] Status badge component (ACTIVE / SETTLED / ARCHIVED / PENDING / CONFIRMED)

---

### Phase 3 — Core Backend & Data Logic
**Goal:** All API endpoints implemented and returning real data. Business logic unit-tested.

**Auth module**
- [ ] `POST /auth/register` — create user, hash password (bcrypt), queue verification email
- [ ] `POST /auth/login` — validate credentials, return JWT pair in HttpOnly cookies
- [ ] `POST /auth/refresh` — rotate refresh token, return new access token
- [ ] `POST /auth/logout` — clear cookies
- [ ] `POST /auth/verify-email` — verify token from email link
- [ ] `POST /auth/forgot-password` — send reset link
- [ ] `POST /auth/reset-password` — validate token, update password
- [ ] JWT auth guard + role guard (ADMIN, ORGANIZER, MEMBER)

**Users module**
- [ ] `GET /users/me` — return current user profile
- [ ] `PATCH /users/me` — update name and avatar

**Events module**
- [ ] `POST /events` — create event, auto-add organizer as ORGANIZER member
- [ ] `GET /events` — list events the current user belongs to
- [ ] `GET /events/:id` — get event detail (members-only access)
- [ ] `PATCH /events/:id` — update event (organizer only)
- [ ] `DELETE /events/:id` — soft delete / archive (organizer only)
- [ ] `GET /events/:id/invite` — return invite link token
- [ ] `POST /events/:id/join` — join event via token (auto-register guest account if new)
- [ ] `POST /events/:id/members` — add member by email or guest by name (organizer only)
- [ ] `DELETE /events/:id/members/:memberId` — remove member (organizer only)

**Expenses module**
- [ ] `POST /events/:id/expenses` — create expense + splits (equal or custom)
- [ ] `GET /events/:id/expenses` — list all non-deleted expenses
- [ ] `PATCH /events/:id/expenses/:expenseId` — edit expense (creator or organizer)
- [ ] `DELETE /events/:id/expenses/:expenseId` — soft delete (creator or organizer)
- [ ] `GET /events/:id/balances` — run debt simplification algorithm, return results
- [ ] Balance calculation service (unit tested independently)
- [ ] Cloudinary upload service (receipt photos)

**Settlements module**
- [ ] `POST /events/:id/settlements` — record settlement (status: PENDING)
- [ ] `GET /events/:id/settlements` — list all settlements
- [ ] `PATCH /events/:id/settlements/:settlementId/confirm` — confirm (recipient or organizer)
- [ ] `DELETE /events/:id/settlements/:settlementId` — reject / delete PENDING settlement
- [ ] MoMo deep-link generator utility
- [ ] VNPay deep-link generator utility

**Notifications module**
- [ ] `POST /events/:id/reminders` — send email reminder to a debtor (organizer only)
- [ ] Rate-limit check: reject if reminder sent in last 24h for this member
- [ ] Resend email service (reminder template + PDF download link)

**Messages module**
- [ ] `GET /events/:id/messages` — fetch message history (paginated)
- [ ] `POST /events/:id/messages` — post a message (REST fallback)
- [ ] Socket.io gateway: `joinRoom`, `leaveRoom`, `sendMessage`, `newMessage` events

**Export module**
- [ ] `POST /events/:id/export/pdf` — generate PDF report, upload to Cloudinary, return URL
- [ ] PDF content: event summary, expense list, balance table, settlement history

**Admin module**
- [ ] `GET /admin/users` — paginated user list
- [ ] `PATCH /admin/users/:id` — activate / deactivate user
- [ ] `GET /admin/events` — paginated event list
- [ ] `PATCH /admin/events/:id/archive` — force archive event
- [ ] `GET /admin/stats` — total users, events, VND tracked

---

### Phase 4 — Connect UI to Data
**Goal:** Replace all static data in the UI with live API calls.

**API client setup**
- [ ] Create typed fetch wrapper in `apps/web/lib/api.ts` (attaches JWT, handles 401 refresh)
- [ ] Configure TanStack Query provider in the app root
- [ ] Define typed query/mutation hooks per domain in `apps/web/lib/hooks/`

**Auth**
- [ ] Wire login form → `POST /auth/login` → redirect to dashboard on success
- [ ] Wire register form → `POST /auth/register` → show "check your email" screen
- [ ] Wire forgot password form → `POST /auth/forgot-password`
- [ ] Protect `(app)` routes: redirect to `/login` if no valid session
- [ ] Protect `/admin` routes: redirect to `/dashboard` if not Admin

**Dashboard & events**
- [ ] Dashboard fetches and renders real event list
- [ ] Create Event form submits → redirects to new event detail page
- [ ] Event detail fetches event data and member list

**Expenses**
- [ ] Expense list fetches real expenses for the event
- [ ] Add Expense form submits with correct split payload
- [ ] Edit and delete actions wired up with optimistic UI updates
- [ ] Receipt photo: upload to Cloudinary via signed URL before form submit

**Balances**
- [ ] Balance tab fetches `/balances` endpoint and renders simplified transaction list
- [ ] Live recalculates after any expense create/edit/delete

**Settlements**
- [ ] Settlement list fetches real data with status badges
- [ ] Record Settlement form submits and shows PENDING entry immediately
- [ ] Confirm and reject buttons wired to API; balance view updates after confirm

**Reminders**
- [ ] Send Reminder button (organizer only) calls notifications API
- [ ] Shows "last reminded at …" from API response
- [ ] Disables button with countdown if within 24h rate limit window

**Chat**
- [ ] On mount, connect to Socket.io room for the event
- [ ] Fetch message history via REST on load
- [ ] Send message over WebSocket; append to list on `newMessage` event
- [ ] Fall back to polling if WebSocket connection fails

**PDF export**
- [ ] Export button calls `/export/pdf`, shows loading state, then download link

**Admin**
- [ ] Admin dashboard fetches stats, user list, and event list
- [ ] Deactivate/activate and archive actions wired to admin endpoints

---

### Phase 5 — Validation and Error States
**Goal:** Every form and every page handles bad input and failures gracefully.

**Form validation (React Hook Form + Zod)**
- [ ] Login: required fields, valid email format
- [ ] Register: required fields, valid email, password min 8 chars, passwords match
- [ ] Create Event: name required, type required
- [ ] Add Expense: amount > 0 required, description required, custom split must sum to total
- [ ] Record Settlement: amount > 0, method required
- [ ] Chat input: non-empty message

**API error handling**
- [ ] 400 Bad Request → show field-level error messages in Vietnamese
- [ ] 401 Unauthorized → clear session, redirect to login
- [ ] 403 Forbidden → show "Bạn không có quyền thực hiện thao tác này"
- [ ] 404 Not Found → show inline "Không tìm thấy" message (not a full-page redirect)
- [ ] 429 Too Many Requests (reminder rate limit) → show time remaining in Vietnamese
- [ ] 500 Server Error → show generic error toast with retry option
- [ ] Network offline → show "Mất kết nối, đang thử lại…" banner

**Loading states**
- [ ] Skeleton loaders on: dashboard event list, expense list, balance view, settlement list, chat history, admin tables
- [ ] Spinner on all form submit buttons while request is in flight
- [ ] Disable submit button after click to prevent double-submit

**Empty states**
- [ ] Dashboard: no events yet
- [ ] Expense list: no expenses logged
- [ ] Balance view: everyone is settled (zero balances)
- [ ] Settlement list: no settlements recorded
- [ ] Chat: no messages yet
- [ ] Admin user/event tables: no results

**Edge cases**
- [ ] Invite link: expired or invalid token → show friendly error and link to register
- [ ] Custom split: real-time sum display turns red when it doesn't match the total
- [ ] Receipt upload: file too large (> 5 MB) or wrong type → show error before upload
- [ ] Removing a member who has expenses → confirm dialog explaining their history is kept

---

### Phase 6 — Local Run Instructions
**Goal:** Any developer (or the user demoing) can get the full stack running locally in under 10 minutes.

- [ ] Document prerequisites in `README.md`:
  - Node.js ≥ 20
  - pnpm ≥ 9
  - Docker (for local Postgres) OR a free Neon account
- [ ] Step-by-step setup in `README.md`:
  1. `git clone` the repo
  2. `pnpm install` at repo root
  3. Copy `.env.example` → `.env`, fill in required variables (list the minimum required ones for local dev)
  4. `pnpm db:migrate` — run Prisma migrations
  5. `pnpm db:seed` — seed one demo event with expenses
  6. `pnpm dev` — starts both `apps/web` (port 3000) and `apps/api` (port 4000) in parallel
- [ ] Document how to reset the database: `pnpm db:reset`
- [ ] Add `apps/api/prisma/seed.ts` that creates:
  - 1 admin user (`admin@titra.local` / `password123`)
  - 2 regular users
  - 1 event with 5 expenses and 1 settlement
- [ ] Document common errors and fixes:
  - `DATABASE_URL` not set → what error looks like and where to get a Neon URL
  - Port already in use → how to change the port
  - Prisma client not generated → run `pnpm prisma generate`

---

### Phase 7 — ngrok Demo Setup
**Goal:** Share a working live demo from localhost with anyone via a public URL.

- [ ] Add ngrok setup instructions to `README.md` under a "Demo / Sharing" section:
  1. Install ngrok: `brew install ngrok` (Mac) or download from ngrok.com
  2. Create a free ngrok account and add your auth token: `ngrok config add-authtoken <token>`
  3. Expose the API: `ngrok http 4000` → copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`)
  4. Expose the web app: open a second terminal, `ngrok http 3000` → copy that HTTPS URL
  5. Update `.env` on the demo machine:
     ```
     NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
     NEXT_PUBLIC_APP_URL=https://xyz789.ngrok-free.app
     NEXTAUTH_URL=https://xyz789.ngrok-free.app
     ```
  6. Restart `pnpm dev`
- [ ] Configure NestJS CORS to accept the ngrok domain dynamically (read from env, not hardcoded)
- [ ] Test the full invite link flow over the public URL (critical: link must use the public domain)
- [ ] Document the demo script — what to show and in what order:
  1. Register as organizer → create "Đà Lạt weekend" event
  2. Copy invite link → open in incognito → join as a second member
  3. Log 3 expenses with different payers and splits
  4. Show the Balances tab (simplified debts)
  5. Record a settlement → confirm it → show balance update
  6. Send a reminder email
  7. Export PDF
