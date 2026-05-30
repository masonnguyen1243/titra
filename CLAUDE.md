# CLAUDE.md

Guidelines for AI agents working on the Titra codebase.

---

## Before Writing Any Code

1. Read `specs/product-spec.md` to understand what the feature is and its acceptance criteria.
2. Read `specs/implementation-plan.md` to confirm which phase is active and what's in scope.
3. If the task is unclear or conflicts with the spec, ask before proceeding.

---

## While Coding

- Implement **one phase or one task at a time**. Do not jump ahead.
- Keep the code simple. If something feels over-engineered, it probably is.
- Do not install a new library if an existing dependency can do the job.
- Do not change the architecture (monorepo structure, tech choices, API design) unless `specs/implementation-plan.md` has been updated to reflect that change.
- All code in English. All user-facing strings in Vietnamese.

---

## After Each Implementation

1. Append an entry to `specs/change-log.md` describing what was built or changed.
2. Explain how to test the change — what to run, what to click, what the expected result is. Keep it short: 3–5 bullet points is enough.

---

## Stack Rules (non-negotiable)

| Area     | Rule                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Frontend | Next.js 15 App Router only. shadcn/ui for components. TailwindCSS for styling. No other UI libraries. |
| Backend  | NestJS modular architecture. Prisma for all DB access — no raw SQL. REST under `/api/v1`.             |
| Forms    | React Hook Form + Zod.                                                                                |
| State    | TanStack Query for server state. Zustand for client state.                                            |
| Database | PostgreSQL. Amounts stored as integers (VND, no decimals). Soft-delete on user-created records.       |
| Auth     | JWT access token (15 min) + refresh token (7 days) in HttpOnly cookies.                               |
| Types    | TypeScript strict mode. No `any` without a comment explaining why.                                    |

---

## Hard Rules

- Never hardcode secrets. Use environment variables.
- Never modify DB schema without a Prisma migration file.
- Never log passwords, tokens, or payment data.
- Never skip `pnpm lint` and `pnpm typecheck` before calling a task done.
- Never add a feature outside the current phase's scope without updating the spec first.
