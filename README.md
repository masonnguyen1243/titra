# Titra

> Chia tiền thông minh — Không còn ai nợ ai mà không biết.

Titra is a lightweight expense-splitting web app for friend groups. Create a trip or shared meal, add members, log who paid what, and let Titra calculate exactly who owes whom — then settle up with integrated payment links (MoMo, VNPay).

---

## Features

- Create events (trips, meals, outings)
- Invite members via shareable link or manually
- Log expenses with flexible splits (equal or custom ratio)
- Optional bill photo upload
- Auto-calculated balances for every member
- Mark settlements via MoMo / VNPay
- Debt reminders via Email, SMS, Zalo, Messenger, Telegram
- In-trip chat and comments
- PDF export of final settlement report
- Admin dashboard for system management
- Role-based access control (Admin, Organizer, Member)

---

## Tech Stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Frontend   | Next.js 14, TypeScript, TailwindCSS, shadcn/ui |
| Backend    | NestJS, TypeScript                  |
| Database   | PostgreSQL + Prisma ORM             |
| Auth       | NextAuth.js / JWT                   |
| Storage    | Cloudinary (bill photos)            |
| Email      | Resend                              |
| PDF        | @react-pdf/renderer                 |

---

## Project Structure

```
titra/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   └── shared/       # Shared types and utilities
├── specs/            # Product specs and planning docs
└── README.md
```

---

## Getting Started

> Setup instructions will be added once scaffolding is complete.

---

## Specs

- [Product Spec](specs/product-spec.md)
- [Implementation Plan](specs/implementation-plan.md)
- [Test Plan](specs/test-plan.md)
- [Change Log](specs/change-log.md)
