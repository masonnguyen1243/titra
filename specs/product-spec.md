# Product Spec — Titra

**Version:** 0.1 (MVP)
**Last updated:** 2026-05-24

---

## 1. Problem Statement

After a group trip or shared meal, splitting expenses fairly is painful. People use spreadsheets, notes apps, or just argue. Titra makes it zero-effort: log what was spent, by whom, and for whom — Titra handles the math and the reminders.

Target users: Vietnamese friend groups aged 18–35 who travel or dine out together regularly.

---

## 2. User Roles

| Role      | Description |
|-----------|-------------|
| **Admin** | System admin. Manages all users and events via dashboard. |
| **Organizer** | Creates and owns an event. Can add members, edit expenses, send reminders, and close the event. |
| **Member** | Participates in an event. Can log expenses, view balances, chat, and mark their own debts as settled. |

---

## 3. Core Entities

### Event
An Event is a trip or shared meal with a defined group.

| Field         | Type       | Notes |
|---------------|------------|-------|
| id            | uuid       |       |
| name          | string     | e.g. "Đà Lạt tháng 5" |
| description   | string?    |       |
| type          | enum       | TRIP, MEAL, OTHER |
| currency      | string     | Default: VND |
| coverImage    | string?    | URL   |
| status        | enum       | ACTIVE, SETTLED, ARCHIVED |
| organizerId   | uuid       | FK → User |
| createdAt     | datetime   |       |
| deletedAt     | datetime?  | Soft delete |

### Member (EventMember)
Junction between User and Event.

| Field      | Type   | Notes |
|------------|--------|-------|
| id         | uuid   |       |
| eventId    | uuid   |       |
| userId     | uuid?  | Null if guest (added by name only) |
| nickname   | string | Display name inside the event |
| role       | enum   | ORGANIZER, MEMBER |
| joinedAt   | datetime |     |

### Expense
A single payment made by one person on behalf of the group (or a subset).

| Field       | Type     | Notes |
|-------------|----------|-------|
| id          | uuid     |       |
| eventId     | uuid     |       |
| paidById    | uuid     | FK → EventMember |
| amount      | int      | In VND (integer, no decimals) |
| description | string   |       |
| category    | enum     | FOOD, TRANSPORT, ACCOMMODATION, ACTIVITY, OTHER |
| receiptUrl  | string?  | Cloudinary URL |
| splitType   | enum     | EQUAL, CUSTOM |
| createdAt   | datetime |       |
| deletedAt   | datetime? |      |

### ExpenseSplit
How one expense is distributed across members.

| Field       | Type   | Notes |
|-------------|--------|-------|
| id          | uuid   |       |
| expenseId   | uuid   |       |
| memberId    | uuid   | FK → EventMember |
| amount      | int    | Their share in VND |

### Settlement
Records when a debt between two members is marked as paid.

| Field        | Type     | Notes |
|--------------|----------|-------|
| id           | uuid     |       |
| eventId      | uuid     |       |
| fromMemberId | uuid     | Who paid |
| toMemberId   | uuid     | Who received |
| amount       | int      |       |
| method       | enum     | MOMO, VNPAY, CASH, OTHER |
| proofUrl     | string?  | Screenshot of transfer |
| status       | enum     | PENDING, CONFIRMED |
| confirmedAt  | datetime? |      |
| createdAt    | datetime |       |

### Message (Chat)
Comments or chat messages within an event.

| Field     | Type     | Notes |
|-----------|----------|-------|
| id        | uuid     |       |
| eventId   | uuid     |       |
| memberId  | uuid     |       |
| content   | string   |       |
| createdAt | datetime |       |

---

## 4. Feature Specifications

### 4.1 Authentication & Authorization

- Register with email + password or Google OAuth.
- Email verification required before first login.
- JWT access token (15 min) + refresh token (7 days) in HttpOnly cookie.
- Forgot password via email reset link.
- Role-based guards on all API routes.

### 4.2 Event Management

- Organizer creates event with name, type, optional description and cover photo.
- System generates a shareable invite link (`/join/{token}`).
- Organizer can add members manually (by email or just a name for guests).
- Members join via invite link (auto-creates account if new) or accept email invitation.
- Organizer can remove members (their expense history is preserved).
- Event can be archived once all settlements are confirmed.

### 4.3 Expense Logging

- Any authenticated member can add an expense.
- Fields: payer (dropdown of members), amount, description, category, optional receipt photo.
- Split modes:
  - **Equal**: divided evenly across all selected members.
  - **Custom**: organizer or payer manually enters each person's share (must sum to total).
- Expense can be edited or deleted by the creator or organizer (soft delete).
- Receipt photo uploaded to Cloudinary, max 5 MB, JPG/PNG/HEIC.

### 4.4 Balance Calculation

- Balances are computed in real-time from all non-deleted expenses and confirmed settlements.
- Algorithm: minimize number of transactions (debt simplification).
- Display: per-member summary and a list of "X owes Y: Z VND" pairs.
- All amounts rounded to nearest 1,000 VND for display (raw integer stored).

### 4.5 Settlements

- Any member can record a settlement: "I paid Y [amount] via MoMo".
- Settlement status starts as PENDING.
- Recipient (or organizer) confirms it → status becomes CONFIRMED.
- Confirmation triggers notification to the organizer.
- If confirmed, that amount is subtracted from the balance calculation.

### 4.6 Payment Gateway Integration (MVP: link-based only)

- MVP approach: generate a deep-link URL to MoMo or VNPay with pre-filled amount and recipient.
- No actual API integration with payment gateways in MVP (full integration is Phase 2).
- Member pastes transfer confirmation screenshot as proof.

### 4.7 Reminders

- Organizer selects a debtor and sends a reminder.
- Reminder channels (MVP): Email only.
- Phase 2: SMS, Zalo OA, Messenger, Telegram bot.
- Reminder content: event name, amount owed, a link to the event, payment link.
- Rate limit: max 1 reminder per debtor per 24 hours.

### 4.8 Chat / Comments

- Simple message thread scoped to an event.
- Members can post text messages.
- Messages are real-time via WebSocket (Socket.io) or polling fallback.
- No threads, reactions, or attachments in MVP.

### 4.9 PDF Export

- Organizer triggers PDF export from event settings.
- PDF includes: event summary, list of all expenses, balance table, settlement history.
- Generated server-side; download link emailed and also shown in UI.

### 4.10 Admin Dashboard

- Accessible only to Admin role.
- Pages: User list, Event list, system metrics (total events, total users, total amount tracked).
- Admin can deactivate users or archive events.

---

## 5. Non-Functional Requirements

| Area         | Requirement |
|--------------|-------------|
| Performance  | Balance page loads < 2s for events with up to 200 expenses |
| Mobile       | Fully usable on 375px viewport (iOS Safari, Android Chrome) |
| Accessibility | WCAG 2.1 AA for core flows |
| Localization | Vietnamese first; i18n architecture for English later |
| Security     | OWASP Top 10 compliance; no plain-text secrets |
| Uptime       | 99.5% (single-region deployment for MVP) |

---

## 6. Out of Scope (MVP)

- Native mobile apps
- Multi-currency conversion
- Recurring expenses
- Direct MoMo/VNPay API payment processing
- SMS / Zalo / Messenger / Telegram reminders (email only for MVP)
- Social features (public events, friends list)
- Bank account linking
