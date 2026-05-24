# Product Spec — Titra

**Version:** 0.2 (MVP)
**Last updated:** 2026-05-24

---

## 1. App Goal

Titra helps friend groups track shared expenses and settle debts after trips or meals — without spreadsheets or arguments.

One person creates an event, adds the group, logs what was spent and by whom, and Titra calculates who owes what. Members settle up via MoMo or VNPay and mark it done in the app.

---

## 2. Target Users

- Vietnamese friend groups aged 18–35
- People who travel together or eat out regularly
- At least one person in the group is comfortable enough with apps to organize a trip

**Two types of participants:**

| Type | Description |
|------|-------------|
| Registered user | Has a Titra account. Can log in, add expenses, settle debts, and chat. |
| Guest (name-only) | Added by the organizer by name only — no account required. Used for friends who don't join the app. Expenses can be assigned to them but they cannot act in the app. |

---

## 3. User Roles

| Role | Who | What they can do |
|------|-----|-----------------|
| **Admin** | System operator | Manage all users and events via admin dashboard |
| **Organizer** | Trip/meal creator | Full control over the event: add/remove members, edit any expense, send reminders, export PDF, archive event |
| **Member** | Participant with account | Add expenses, view balances, record and confirm settlements, chat |

---

## 4. Core User Flow

This is the primary journey Titra is designed to support:

```
1. Organizer registers → creates event (trip or meal)
        ↓
2. Organizer shares invite link → friends join (or organizer adds guests by name)
        ↓
3. During the event, any member logs an expense:
   who paid · how much · what for · split equally or by custom ratio · optional photo
        ↓
4. Titra auto-calculates balances → shows who owes whom and how much
        ↓
5. Debtor sends money via MoMo / VNPay (external) → records settlement in app with proof screenshot
        ↓
6. Creditor (or organizer) confirms settlement → balance updates
        ↓
7. Organizer sends reminders to anyone who hasn't settled
        ↓
8. Once all debts are settled → organizer exports PDF report → archives event
```

---

## 5. Features In Scope

### 5.1 Authentication

**What it does:** Users register and log in with email/password or Google. Access is role-gated.

**Acceptance criteria:**
- User can register with email + password; receives a verification email before first login.
- User can log in with Google OAuth.
- Unverified email accounts cannot access the app.
- Forgot password sends a reset link to the registered email.
- All authenticated sessions use JWT (access token 15 min, refresh token 7 days in HttpOnly cookie).
- Accessing any protected route without a valid token returns 401.
- Accessing a route above one's role (e.g. member accessing organizer action) returns 403.

---

### 5.2 Event Management

**What it does:** Organizer creates and manages the group event.

**Acceptance criteria:**
- Organizer can create an event with: name (required), type (TRIP / MEAL / OTHER), optional description and cover photo.
- System generates a unique shareable invite link per event.
- Organizer can add a member by email (sends invite) or by name only (guest, no account needed).
- Clicking the invite link redirects new users to register then auto-joins the event; existing users are auto-joined after login.
- Organizer can remove a member; their logged expenses are preserved and still count toward balances.
- Event status transitions: ACTIVE → SETTLED (all debts confirmed) → ARCHIVED (organizer action).

---

### 5.3 Expense Logging

**What it does:** Any member records a payment made on behalf of the group.

**Acceptance criteria:**
- Any authenticated member can add an expense with: payer (any member or guest in the event), amount (VND integer, > 0), description (required), category, optional receipt photo.
- Split modes:
  - **Equal:** amount divided evenly across selected members; remainder (if not divisible) goes to the first member in the list.
  - **Custom:** user enters each member's share manually; total must equal the expense amount or submission is rejected with an error.
- Expense creator or organizer can edit or soft-delete an expense.
- Receipt photo: max 5 MB, JPG / PNG / HEIC, uploaded to Cloudinary.
- Deleted expenses are excluded from all balance calculations.

---

### 5.4 Balance Calculation

**What it does:** Titra computes who owes whom after all expenses and settlements.

**Acceptance criteria:**
- Balances are recalculated on every page load from all non-deleted expenses and confirmed settlements.
- Algorithm minimizes the number of transactions (debt simplification): if A owes B and B owes C, result is A owes C directly.
- Balance page shows: each member's net position (positive = owed money, negative = owes money) and a simplified list of "X owes Y: Z ₫" pairs.
- Sum of all balances in an event is always zero.
- Amounts are displayed rounded to nearest 1,000 ₫; raw integers are stored.
- If all balances are zero, page shows "Mọi người đã huề cả làng 🎉".

---

### 5.5 Settlements

**What it does:** Members record and confirm real-world payments.

**Acceptance criteria:**
- Any member can record a settlement: select who they paid, enter amount, select method (MoMo / VNPay / Cash / Other), optionally upload a transfer screenshot.
- Settlement is created with status PENDING.
- The recipient or the organizer can confirm the settlement → status changes to CONFIRMED.
- On confirmation, the organizer receives an email notification.
- Confirmed settlement amount is subtracted from the debtor's balance immediately.
- A PENDING settlement does not affect balances until confirmed.
- Organizer or recipient can reject a PENDING settlement → it is deleted.

---

### 5.6 Payment Links (MoMo / VNPay)

**What it does:** Generates a pre-filled deep link to send money via MoMo or VNPay. No direct API integration in MVP — the transfer happens outside Titra.

**Acceptance criteria:**
- On the settlement form, selecting MoMo or VNPay generates a tappable deep-link pre-filled with the correct amount.
- Link opens the MoMo or VNPay app on mobile (or shows QR on desktop).
- No payment data is processed or stored by Titra — only the member's uploaded proof screenshot.

---

### 5.7 Debt Reminders

**What it does:** Organizer nudges members who haven't settled.

**Acceptance criteria:**
- Organizer can send a reminder to any member with an outstanding balance.
- Reminder is sent via email (MVP only) containing: event name, amount owed, link to the event, and a MoMo/VNPay payment link.
- Maximum 1 reminder per member per 24 hours; attempting to send another within that window shows an error message with the time remaining.
- Organizer sees a timestamp of the last reminder sent to each member.

---

### 5.8 Chat

**What it does:** Simple text thread inside each event for coordination.

**Acceptance criteria:**
- Any authenticated member can post text messages in the event chat.
- Messages appear in real time (WebSocket); fall back to 5-second polling if WebSocket is unavailable.
- Messages are ordered chronologically, oldest first.
- No editing or deleting messages in MVP.
- No file attachments, reactions, or threads in MVP.

---

### 5.9 PDF Export

**What it does:** Generates a shareable settlement report for the event.

**Acceptance criteria:**
- Organizer can trigger PDF export from the event settings page.
- PDF contains: event name and date range, list of all expenses (date, payer, amount, description, split), balance summary table, and settlement history.
- PDF is generated server-side and available as a download link in the UI within 30 seconds.
- Download link is also sent to the organizer's email.

---

### 5.10 Admin Dashboard

**What it does:** Lets the system operator monitor and manage the platform.

**Acceptance criteria:**
- Accessible only to users with the Admin role; any other role is redirected.
- Dashboard shows: total users, total events (active / archived), total VND tracked across all events.
- Admin can view the full user list with email, role, and registration date.
- Admin can deactivate a user (they can no longer log in) or reactivate them.
- Admin can view the full event list and force-archive any event.

---

## 6. Features Out of Scope (MVP)

| Feature | Reason deferred |
|---------|----------------|
| Native iOS / Android apps | Web (mobile-responsive) is sufficient for MVP |
| Multi-currency conversion | Vietnamese groups use VND exclusively |
| Direct MoMo / VNPay API (actual payment processing) | Requires business registration; link-based approach covers MVP needs |
| SMS reminders | Requires paid SMS gateway; email covers MVP |
| Zalo / Messenger / Telegram reminders | Integration complexity; post-MVP |
| Recurring expenses | Not needed for one-off trips and meals |
| Friends list / social graph | Invite links are sufficient for MVP group formation |
| Bank account linking | Regulatory complexity |
| Editing or deleting chat messages | Low priority |
| Multiple currencies per event | Out of scope for VND-only MVP |

---

## 7. Data Model (Summary)

| Entity | Key fields |
|--------|-----------|
| User | id, email, passwordHash, role, emailVerified |
| Event | id, name, type, status, organizerId, inviteToken |
| EventMember | id, eventId, userId (nullable for guests), nickname, role |
| Expense | id, eventId, paidById, amount (int VND), description, category, splitType, receiptUrl, deletedAt |
| ExpenseSplit | id, expenseId, memberId, amount (int VND) |
| Settlement | id, eventId, fromMemberId, toMemberId, amount, method, status, proofUrl, confirmedAt |
| Message | id, eventId, memberId, content, createdAt |

---

## 8. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Performance | Balance page renders in < 2s for events with up to 200 expenses |
| Mobile | Fully usable on 375px viewport (iOS Safari, Android Chrome) |
| Accessibility | WCAG 2.1 AA for core flows (auth, expense form, balance view) |
| Localization | Vietnamese UI first; i18n architecture in place for English later |
| Security | OWASP Top 10 compliance; no secrets in code or logs |
| Uptime | 99.5% target (single-region MVP deployment) |
