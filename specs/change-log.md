# Change Log — Titra

All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

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
