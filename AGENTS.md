# AGENTS.md

Guidelines for AI agents (Claude Code and others) working on this codebase.

---

## Project Context

**Titra** is a group expense-splitting web app. The codebase is a TypeScript monorepo using Next.js (frontend) and NestJS (backend) with PostgreSQL/Prisma.

---

## Language & Locale

- All **code** (variable names, function names, comments, file names) must be written in **English**.
- All **user-facing UI strings** (labels, messages, notifications) should be in **Vietnamese** by default. Use i18n keys where needed so English can be added later.
- Spec documents and comments explaining business logic may mix Vietnamese and English freely.

---

## Stack Conventions

### Frontend (apps/web)
- Next.js 15 App Router only — no Pages Router.
- Use `shadcn/ui` components as the base; do not install competing UI libraries.
- TailwindCSS for styling. Avoid inline `style={}` props unless truly unavoidable.
- Server Components by default; add `"use client"` only when interactivity requires it.
- Data fetching: React Query (TanStack Query) for client-side; `fetch` in Server Components.
- Forms: React Hook Form + Zod for validation.
- State management: Zustand for global client state; avoid Redux.

### Backend (apps/api)
- NestJS with modular architecture (one module per domain).
- Prisma as the ORM — never write raw SQL unless performance profiling demands it.
- DTOs validated with `class-validator` and `class-transformer`.
- REST API under `/api/v1/...`. GraphQL is out of scope for MVP.
- Auth: JWT access tokens (15 min) + refresh tokens (7 days), stored in HttpOnly cookies.

### Shared (packages/shared)
- Zod schemas that are used by both frontend and backend live here.
- No framework-specific imports allowed in this package.

---

## Database Rules

- **Never** modify production schema without a Prisma migration file.
- Financial amounts are stored as **integers in the smallest currency unit** (VND đồng — no decimals needed).
- All timestamps use UTC; formatting is the client's responsibility.
- Soft-delete (`deletedAt`) on all user-created entities (Events, Expenses, Members).

---

## Code Quality

- TypeScript strict mode is enabled. No `any` unless explicitly justified with a comment.
- All API endpoints must have corresponding DTOs and response types.
- Write unit tests for all pure functions in `packages/shared` and service-layer logic.
- Write integration tests (Supertest) for all API endpoints.
- Run `pnpm lint` and `pnpm typecheck` before marking any task done.

---

## Security

- Never log sensitive data (passwords, tokens, payment info).
- Sanitize all user inputs. Never interpolate user input into strings passed to `exec`, `eval`, or raw SQL.
- All financial mutation endpoints require authentication and ownership checks.
- Payment gateway webhooks must verify signatures before processing.

---

## What NOT to Do

- Do not add features beyond the current sprint's scope without discussion.
- Do not install packages without checking if an existing dependency already covers the need.
- Do not hardcode secrets — use environment variables.
- Do not bypass ESLint/TypeScript errors with `@ts-ignore` or `eslint-disable` without a comment explaining why.
- Do not delete migration files or squash migrations without explicit instruction.

---

## Task Workflow

1. Read `specs/product-spec.md` to understand the domain before touching a feature area.
2. Check `specs/implementation-plan.md` for the current phase and its scope.
3. After any meaningful change, append an entry to `specs/change-log.md`.
4. Keep PRs small and focused on one feature or fix.
