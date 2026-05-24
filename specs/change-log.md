# Change Log — Titra

All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

---

## 2026-05-24 (6) — Phase 2: Register page

**Files changed:**
- `apps/web/app/(auth)/register/page.tsx`: replaced placeholder with full register form — name field, email field, password field, "Tạo tài khoản" button, Google OAuth button, link back to login page. Client component with controlled inputs. No API calls yet.

---

## 2026-05-24 (5) — Phase 2: Login page

**Files changed:**
- `apps/web/app/(auth)/login/page.tsx`: replaced placeholder with full login form — email field, password field with "Quên mật khẩu?" link, Login button, Google OAuth button, link to register page. Client component with controlled inputs. No API calls yet.

**Fix — review against acceptance criteria:**
- Wrapped email/password fields and submit button in a `<form>` element so Enter key submits and password managers work correctly.
- Removed explicit `React.FormEvent` type annotation (deprecated in React 19); used inline `onSubmit={(e) => e.preventDefault()}` instead.

---

## 2026-05-24 (4) — Phase 1: Project Setup complete

**Files created:**
- Root: `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `.prettierrc`, `.prettierignore`
- `apps/web`: Next.js 15 scaffold with TailwindCSS v4, shadcn/ui base components (Button, Input, Card, Badge, Label, Separator, Tabs, Dialog, Toaster), route groups `(auth)` and `(app)`, placeholder pages
- `apps/api`: NestJS scaffold with global prefix `/api/v1`, helmet, compression, CORS, throttler, `GET /api/v1/health` endpoint, PrismaService (global module)
- `apps/api/prisma/schema.prisma`: Full schema — User, Event, EventMember, Expense, ExpenseSplit, Settlement, Message with all enums
- `packages/shared`: Zod schemas for auth, events, expenses, settlements
- `.github/workflows/ci.yml`: lint + typecheck + test on push/PR

**Pending:** ~~Run `pnpm db:migrate` once `DATABASE_URL` is set in `.env`.~~ ✓ Done.

---

## 2026-05-24 (3) — Implementation plan revision

- Rewrote `specs/implementation-plan.md` to v0.2: restructured phases from domain-slices into 7 build stages (Setup → UI → Backend → Connect → Validation → Local Run → ngrok Demo). Each phase now has granular checklist items.

---

## 2026-05-24 (2) — Spec revision

- Rewrote `specs/product-spec.md` to v0.2: added explicit App Goal, Target Users, Core User Flow diagram, per-feature Acceptance Criteria, and Out of Scope table. Data model condensed to summary table.

---

## 2026-05-24 — Phase 0

- Initialized project workspace at `/Users/mason/Workspace/masonnguyen/titra`.
- Created `README.md`, `AGENTS.md`, `specs/product-spec.md`, `specs/implementation-plan.md`, `specs/test-plan.md`.
- Decided on tech stack: Next.js 15 + NestJS + PostgreSQL (Neon) + Prisma.
- Defined MVP scope: auth, events, expenses, balances, settlements (link-based), email reminders, chat, PDF export, admin dashboard.
- Out of scope for MVP: native apps, direct payment API integration, SMS/Zalo/Messenger/Telegram reminders.
