# Implementation Plan — Titra

**Version:** 0.2
**Last updated:** 2026-05-27

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
- [x] Run first migration, confirm connection works

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

- [x] Login page (email + password form, Google OAuth button)
- [x] Register page (name, email, password)
- [x] Forgot password page (email input)
- [x] Email sent confirmation screen

**Dashboard**

- [x] Event list page (cards showing event name, type, member count, status)
- [x] Empty state: "Bạn chưa có chuyến đi nào" with Create button
- [x] Create event form (name, type, description, cover photo upload)

**Event detail**

- [x] Event shell with tab navigation: Expenses · Balances · Settlements · Chat · Members
- [x] Expenses tab: list of expenses with payer, amount, description, category chip
- [x] Add Expense form:
  - [x] Equal split mode (member checkboxes, per-person amount shown live)
  - [x] Custom split mode (amount input per member, running total shown)
  - [x] Receipt photo upload field
- [x] Balances tab: net position per member + simplified "X owes Y: Z ₫" list
- [x] Settlements tab: list of settlements with status badges (PENDING / CONFIRMED)
- [x] Record Settlement form (select payer, amount, method, upload proof)
- [x] Chat tab: message list + text input
- [x] Members tab: member list with role badge + Remove button (organizer only)
- [x] Invite link display with Copy button

**Admin dashboard**

- [x] Stats cards: total users, total events, total VND tracked
- [x] User table: email, role, status, registered date, Deactivate button
- [x] Event table: name, organizer, status, member count, Archive button

**Shared components**

- [x] Loading skeleton component (used across all data-heavy pages)
- [x] Empty state component (reusable with custom icon + message)
- [x] Avatar component (initials fallback if no photo)
- [x] Currency display component (formats integers as "150.000 ₫")
- [x] Status badge component (ACTIVE / SETTLED / ARCHIVED / PENDING / CONFIRMED)

---

### Phase 3 — Core Backend & Data Logic

**Goal:** All API endpoints implemented and returning real data. Business logic unit-tested.

**Auth module**

- [x] `POST /auth/register` — create user, hash password (bcrypt), queue verification email
- [x] `POST /auth/login` — validate credentials, return JWT pair in HttpOnly cookies
- [x] `POST /auth/refresh` — rotate refresh token, return new access token
- [x] `POST /auth/logout` — clear cookies
- [x] `POST /auth/verify-email` — verify token from email link
- [x] `POST /auth/forgot-password` — send reset link
- [x] `POST /auth/reset-password` — validate token, update password
- [x] JWT auth guard + role guard (ADMIN, ORGANIZER, MEMBER)
- [x] `GET /auth/health` — public endpoint that checks JWT config and DB connectivity for the auth subsystem

**Auth module — QA fixes**

- [x] Fix `login()`: check `isActive` before bcrypt compare — current order leaks account status via distinct error messages (F1)
- [x] Fix `resetPassword()`: verify `isActive` before accepting reset token — deactivated user can currently reset password within the 1h TTL window (F2)
- [x] Fix `GET /auth/health`: return HTTP 503 when `status` is `"degraded"` so load balancers detect the degraded state (F3)
- [x] Fix `forgotPassword()`: skip token generation when `emailVerified` is `false` — currently issues reset email for unverified accounts (M11)
- [x] Add `@IsNotEmpty` to `name` field in `RegisterDto` — empty string is currently accepted (M7)

**Auth module — missing features**

- [x] `POST /auth/google` — Google OAuth login via Passport + `@nestjs/passport` strategy (M1)
- [x] `POST /auth/resend-verification` — resend email verification link; needed by the "Gửi lại email" button already in the frontend (M2)
- [x] Refresh token rotation with invalidation: persist refresh token hash in DB, blacklist on use so stolen tokens cannot be replayed for the full 7-day window (M3)
- [x] Stricter per-endpoint rate limiting on `POST /auth/login` and `POST /auth/forgot-password` (e.g. 5 req/min per IP) separate from the global 60 req/min bucket (M9)

**Auth module — unit & integration test gaps**

- [x] Unit test: `login()` with `isActive: false` → 401 (M4)
- [x] Unit test: `refresh()` with expired token (correct secret, `exp` in past) → 401 (M5)
- [x] Unit test: `refresh()` with inactive user → 401 (M6)
- [x] Unit test: `refresh()` with unverified user → 401 (M6)
- [x] Integration tests for all auth endpoints (`register`, `login`, `refresh`, `logout`, `verify-email`, `forgot-password`, `reset-password`) using Supertest + Neon DB (M10)

**Users module**

- [x] `GET /users/me` — return current user profile
- [x] `PATCH /users/me` — update name and avatar

**Events module**

- [x] `POST /events` — create event, auto-add organizer as ORGANIZER member
- [x] `GET /events` — list events the current user belongs to
- [x] `GET /events/:id` — get event detail (members-only access)
- [x] `PATCH /events/:id` — update event (organizer only)
- [x] `DELETE /events/:id` — soft delete / archive (organizer only)
- [x] `GET /events/:id/invite` — return invite link token
- [x] `POST /events/:id/join` — join event via token (auto-register guest account if new)
- [x] `POST /events/:id/members` — add member by email or guest by name (organizer only)
- [x] `DELETE /events/:id/members/:memberId` — remove member (organizer only)

**Events module — QA fixes**

- [x] Fix `removeMember`: cho phép xoá thành viên dù có lịch sử tài chính — hiện tại service trả 409 Conflict, trái với spec §5.2 ("their logged expenses are preserved and still count toward balances"). Cần thay đổi schema: hoặc soft-delete `EventMember`, hoặc cho `Expense.paidById` nullable + `onDelete: SetNull` (F1)
- [x] Fix `addMember` by email: gửi email thông báo mời cho người dùng khi organizer thêm qua email — hiện tại chỉ tạo thẳng `EventMember` row mà không gửi bất kỳ thông báo nào (F2)
- [x] Fix `addMember` by email: luồng mời phải có bước chấp nhận — hiện tại người dùng bị thêm thẳng vào event mà không cần đồng ý, vi phạm privacy và trái với spec §5.2 ("sends invite"). Cần: (1) thêm `status` vào `EventMember` hoặc tạo bảng `EventInvitation` với `inviteToken` + `expiresAt`; (2) `addMember` chỉ tạo bản ghi `PENDING` và gửi email chứa link `accept`; (3) thêm `POST /events/:id/invitations/:token/accept` để người dùng xác nhận → chuyển status sang `MEMBER`; (4) chỉ `MEMBER` (không phải `PENDING`) mới được tính vào balance và thấy dữ liệu event (F5)
- [x] Fix `addMember` by email: kiểm tra `isActive` và `emailVerified` của target user trước khi thêm vào event — hiện tại user bị deactivate hoặc chưa verify vẫn được thêm vào (F3)
- [x] Fix `joinEvent`: chặn join event có status `SETTLED`, không chỉ `ARCHIVED` — member mới join sau khi đã settle sẽ phá vỡ số dư (F4)
- [x] Fix `addMember` by email: trả về 200 thay vì tiết lộ sự tồn tại của email khi không tìm thấy user (hiện trả 404 — là oracle liệt kê tài khoản); theo pattern enumeration-safe đã dùng ở `forgotPassword` (S3)

**Events module — QA fixes (Round 2)**

- [x] Fix `joinEvent`: khi restore thành viên bị remove, set lại `status: ACTIVE` — hiện tại chỉ reset `removedAt` nên thành viên có status `PENDING` vẫn bị khoá khỏi event sau khi rejoin qua invite link công khai (F1)
- [x] Fix `addMember`: chặn cả event `SETTLED` (không chỉ `ARCHIVED`) — organizer hiện vẫn thêm được thành viên vào event đã chốt, làm sai balance (F2)
- [x] Fix `acceptInvitation`: kiểm tra event chưa bị soft-delete (`deletedAt: null`) và status không phải `SETTLED`/`ARCHIVED` trước khi activate member — hiện tại có thể accept invite vào event đã xoá hoặc đã kết thúc (F3)
- [x] Fix `EVENT_LIST_SELECT`: thêm filter cho `_count.members` chỉ đếm member `status: ACTIVE, removedAt: null` — hiện tại số lượng thành viên trên dashboard bao gồm cả PENDING và đã bị remove (F4)
- [x] Fix URL format mâu thuẫn: `getInvite` trả về `/join/:eventInviteToken` còn `sendEventInviteEmail` gửi `/invitations/accept?token=:memberInviteToken` — hai flow dùng hai loại token khác nhau trỏ vào hai trang frontend khác nhau; cần thống nhất và tạo trang frontend tương ứng (F5)
- [x] Fix `removeMember`: thêm guard chặn xoá thành viên khi event có status `SETTLED` hoặc `ARCHIVED` — xoá member sau khi chốt có thể làm hỏng lịch sử balance (M4)
- [~] ~~Fix `addMember` guest path: kiểm tra và chặn thêm guest trùng `nickname` trong cùng event~~ — bỏ qua, nickname không phải unique identifier (hai người có thể cùng tên) (M5)
- [x] Fix `addMember` enumeration (partial): email không tồn tại → `{ ok: true }`, nhưng email bị deactivate/unverified → trả `400` với message cụ thể — lộ thông tin tài khoản. Cần áp dụng enumeration-safe nhất quán cho cả ba trường hợp (S1)
- [x] Fix `addMember`: ẩn `inviteToken` và `inviteTokenExpiry` khỏi response trả về cho organizer — token chỉ nên được giao đến người được mời qua email, không qua API response (S2)
- [x] Thêm rate limiting per-target cho `POST /events/:id/members`: giới hạn số lần invite đến một email cụ thể trong khoảng thời gian nhất định để tránh spam inbox (S3)

**Events module — missing features**

- [x] `PATCH /events/:id/invite` — regenerate invite token (vô hiệu hoá link cũ, tạo token mới) — frontend đã có nút "Regenerate" nhưng chưa có endpoint backend (M3)
- [x] Thêm FK từ `Event.organizerId` → `User` vào Prisma schema — hiện tại chỉ là `String` thuần, không có `@relation`; nếu user bị xoá sẽ tạo orphaned reference (M4)
- [x] Làm rõ hoặc restrict `GET /events/:id/invite`: spec §5.2 nói organizer chia sẻ invite link; hiện tại mọi member đều gọi được endpoint này (M5)

**Events module — unit & integration test gaps**

- [x] Unit tests cho `EventsService` — hiện tại không có file `events.service.spec.ts` nào, coverage = 0% trong khi test plan yêu cầu ≥ 80% cho mọi API service (M1)
  - `createEvent` — tạo event + organizer member trong transaction
  - `getEvents` — lọc theo membership, loại trừ soft-deleted
  - `getEventDetail` — 404 nếu không tìm thấy, 403 nếu không phải member
  - `updateEvent` — 403 nếu không phải organizer
  - `deleteEvent` — soft-delete, 403 nếu không phải organizer
  - `joinEvent` — 400 nếu ARCHIVED/SETTLED, 400 nếu sai token, 409 nếu đã là member
  - `addMember` — email path (404/409), guest path (tạo với `userId: null`)
  - `removeMember` — 403 nếu không phải organizer, 400 nếu target là ORGANIZER
  - `acceptInvitation` — 404 token không hợp lệ, 403 sai userId, 409 đã là ACTIVE, 400 hết hạn, happy path → status ACTIVE (M3)
- [x] Integration tests cho Events endpoints dùng Supertest + Neon DB — test plan liệt kê đầy đủ các case nhưng chưa có file `events.e2e-spec.ts` nào (M2)
  - `POST /events`, `GET /events`, `GET /events/:id`, `PATCH /events/:id`, `DELETE /events/:id`
  - `GET /events/:id/invite`, `POST /events/:id/join`
  - `POST /events/:id/members`, `DELETE /events/:id/members/:memberId`

**Expenses module**

- [x] `POST /events/:id/expenses` — create expense + splits (equal or custom)
- [x] `GET /events/:id/expenses` — list all non-deleted expenses
- [x] `PATCH /events/:id/expenses/:expenseId` — edit expense (creator or organizer)
- [x] `DELETE /events/:id/expenses/:expenseId` — soft delete (creator or organizer)
- [x] `GET /events/:id/balances` — run debt simplification algorithm, return results
- [x] Balance calculation service (unit tested independently)
- [x] Cloudinary upload service (receipt photos)

**Settlements module**

- [x] `POST /events/:id/settlements` — record settlement (status: PENDING)
- [x] `GET /events/:id/settlements` — list all settlements
- [x] `PATCH /events/:id/settlements/:settlementId/confirm` — confirm (recipient or organizer)
- [x] `DELETE /events/:id/settlements/:settlementId` — reject / delete PENDING settlement
- [x] MoMo deep-link generator utility
- [x] VNPay deep-link generator utility

**Settlements module — QA fixes**

- [x] Fix balance calculation: `GET /events/:id/balances` không đưa confirmed settlements vào tính toán — sau khi confirm settlement, balance page vẫn hiển thị số dư cũ vì `balances.controller.ts` chỉ load `paidExpenses` và `expenseSplits`. Vi phạm spec §5.4 và §5.5. Cần load CONFIRMED settlements per member và trừ amount vào net (F1)
- [x] Fix `deleteSettlement`: người nhận tiền (recipient) không thể reject — hiện tại chỉ payer hoặc organizer mới được xoá, trong khi spec §5.5 nói "organizer or recipient can reject". Cần thêm check `settlement.toMember.userId === callerId` (F2)
- [x] Fix `confirmSettlement`: gửi email thông báo cho organizer khi settlement được confirm — spec §5.5 yêu cầu "On confirmation, the organizer receives an email notification"; hiện tại service không lookup organizer và không gửi email (F3)
- [x] Fix `confirmSettlement`: thêm guard chặn SETTLED/ARCHIVED event — `createSettlement` có guard này nhưng `confirmSettlement` thì không (M4)
- [x] Fix `createSettlement`: kiểm tra `status: MemberStatus.ACTIVE` cho `fromMemberId` và `toMemberId` — hiện chỉ lọc `removedAt: null`, cho phép PENDING member là bên trong settlement (M2)
- [x] Xác nhận `Settlement.method` có DB-level default CASH trong Prisma schema — DTO đánh dấu `@IsOptional()` nhưng Prisma create không set default tường minh; nếu schema thiếu default thì method sẽ là null (M3)
- [x] Fix deep-link generator: encode `phone` và `bankAccount` qua `encodeURIComponent` — số điện thoại dạng `+84912...` làm URL không hợp lệ, app MoMo/VNPay không parse được (S2)

**Settlements module — unit & integration test gaps**

- [x] Unit tests cho `SettlementsService` — không có `.spec.ts`, coverage = 0%, test plan yêu cầu ≥ 80% (M1)
  - `createSettlement` — happy path, event SETTLED/ARCHIVED → 400, fromId = toId → 400, unknown member → 404
  - `confirmSettlement` — recipient ✓, organizer ✓, non-recipient → 403, already CONFIRMED → 400
  - `deleteSettlement` — payer ✓, organizer ✓, recipient ✓ (sau fix F2), non-authorized → 403, CONFIRMED → 400
- [x] Integration tests cho Settlements endpoints dùng Supertest + Neon DB (M1)
  - `POST` → 201 PENDING; `PATCH confirm` → 200 CONFIRMED, non-recipient → 403; `DELETE` → 204 PENDING, CONFIRMED → 400

**Notifications module**

- [x] `POST /events/:id/reminders` — send email reminder to a debtor (organizer only)
- [x] Rate-limit check: reject if reminder sent in last 24h for this member
- [x] Resend email service (reminder template + PDF download link)

**Notifications module — QA fixes**

- [x] Fix reminder email: thêm số tiền đang nợ, link đến event cụ thể (`/events/:eventId`), và payment link MoMo/VNPay — spec §5.7 yêu cầu bốn nội dung bắt buộc; hiện tại email chỉ có tên event và link `/dashboard`. Cần truyền `eventId` và balance data vào `sendReminderEmail()` (F4)
- [x] Fix race condition ở rate limit: pattern read→check→write có TOCTOU window — hai request cùng lúc đều vượt qua check và gửi 2 email. Cần dùng conditional update kiểm tra `count` row affected = 1 (S1)
- [x] Fix reminder link trỏ về `/dashboard`: cần link trực tiếp đến `/events/:eventId` để người nhận không phải tự tìm event (S3)

**Notifications module — unit & integration test gaps**

- [x] Unit tests cho `NotificationsService` — không có `.spec.ts`, coverage = 0%, test plan yêu cầu ≥ 80% (M1)
  - happy path → `{ ok, sentTo, lastReminderAt }`; caller không phải organizer → 403; guest target → 400; trong cooldown → 400 với remaining hours
- [x] Integration test: `POST /events/:id/reminders` — organizer → 200, non-organizer → 403, cooldown → 400

**Messages module**

- [x] `GET /events/:id/messages` — fetch message history (paginated)
- [x] `POST /events/:id/messages` — post a message (REST fallback)
- [x] Socket.io gateway: `joinRoom`, `leaveRoom`, `sendMessage`, `newMessage` events

**Messages module — QA fixes**

- [x] Fix `handleSendMessage` (WebSocket): nội dung tin nhắn không được validate — WS handler nhận `data.content` thô, không qua DTO, cho phép gửi tin rỗng `""` hoặc string vượt quá 2000 ký tự; REST endpoint đã validate đúng nhưng WebSocket path bỏ qua hoàn toàn (F1)
- [x] Fix `handleSendMessage` (WebSocket): người gửi nhận tin nhắn 2 lần — gateway vừa trả `message` làm acknowledgment, vừa `emit('newMessage')` đến toàn room kể cả người gửi; client không dedup sẽ hiển thị trùng lặp (F2)
- [x] Fix CORS trong `MessagesGateway`: `origin: true` phản chiếu mọi origin — bất kỳ website nào cũng có thể mở WebSocket có credential đến server, bypass restriction của HTTP layer. Cần đặt `origin: process.env['NEXT_PUBLIC_APP_URL']` (S1)
- [x] Thêm rate limit cho WebSocket `sendMessage` — không có giới hạn số tin nhắn/giây trên WS; user có thể spam hàng nghìn message/giây, gây quá tải DB và broadcast noise đến toàn room. Cần throttle per-socket tương tự ThrottlerGuard trên HTTP (S2)
- [x] Fix `GetMessagesDto`: validate `cursor` là UUID hợp lệ (`@IsUUID()`) — hiện chỉ `@IsString()`, nếu truyền giá trị tuỳ ý (vd: `?cursor=foo`) Prisma ném runtime error không được catch → HTTP 500 có thể lộ stack trace (M3)
- [x] Fix `isActiveMember`: thêm kiểm tra `deletedAt: null` trên event — hiện chỉ kiểm tra `EventMember`, không kiểm tra event cha có bị soft-delete không; client có thể `joinRoom` vào room của event đã xoá (M4)

**Messages module — missing features**

- [x] Thêm polling fallback 5 giây ở frontend khi WebSocket không kết nối được — spec §5.8 yêu cầu "fall back to 5-second polling if WebSocket is unavailable"; backend đã có REST endpoint nhưng chat page vẫn dùng mock data, chưa có logic polling (F3)

**Messages module — unit & integration test gaps**

- [x] Unit tests cho `MessagesService` — không có `.spec.ts`, coverage = 0%, test plan yêu cầu ≥ 80% cho mọi API service (M1)
  - `getMessages` — member hợp lệ nhận messages; non-member → 403; event không tồn tại → 404; cursor pagination trả đúng `nextCursor`
  - `createMessage` — tạo message thành công; non-member → 403; event không tồn tại → 404
  - `isActiveMember` — trả `true` với ACTIVE member, `false` với PENDING hoặc đã remove
- [x] Unit tests cho `MessagesGateway` — `handleConnection` từ chối token không hợp lệ/thiếu; `handleJoinRoom` từ chối non-member; `handleSendMessage` lưu message và emit `newMessage` đến room (M1)
- [x] Integration tests cho Messages endpoints dùng Supertest + Neon DB — chưa có file `messages.e2e-spec.ts` trong khi auth, events, settlements và notifications đều có (M2)
  - `GET /events/:id/messages` → 200 với member, 403 với non-member, 401 unauthenticated
  - `POST /events/:id/messages` → 201 tạo message, 400 nội dung rỗng, 403 non-member

**Export module**

- [x] `POST /events/:id/export/pdf` — generate PDF report, upload to Cloudinary, return URL
- [x] PDF content: event summary, expense list, balance table, settlement history

**Admin module**

- [x] `GET /admin/users` — paginated user list
- [x] `PATCH /admin/users/:id` — activate / deactivate user
- [x] `GET /admin/events` — paginated event list
- [x] `PATCH /admin/events/:id/archive` — force archive event
- [x] `GET /admin/stats` — total users, events, VND tracked

**Admin module — QA fixes**

- [x] Fix `getStats`: thiếu breakdown active/archived cho `totalEvents` — spec §5.10 yêu cầu "total events (active / archived)" nhưng service chỉ trả một số tổng duy nhất. Cần thêm `activeEvents` và `archivedEvents` vào response (F1)
- [x] Fix `getEvents`: member count đếm cả PENDING member — query filter `removedAt: null` nhưng thiếu `status: MemberStatus.ACTIVE`, tương tự lỗi đã fix ở `EVENT_LIST_SELECT` (entry 71). Cần thêm `status: MemberStatus.ACTIVE` vào filter `_count.members` (F2)
- [x] Fix `totalVnd` Prisma Decimal: `vndResult._sum.amount` trả về `Decimal` object của Prisma, không phải JS `number`. `?? 0` không convert type — JSON serializer có thể trả chuỗi hoặc object thay vì integer. Cần wrap bằng `Number(vndResult._sum.amount ?? 0)` (F3)
- [x] Fix "Quản trị" nav link hiển thị cho mọi user: `apps/web/app/(app)/layout.tsx:13` render link `/admin` không điều kiện cho tất cả user đăng nhập — cần ẩn link này đối với non-admin (liên quan đến Phase 4 wiring nhưng là lỗi UI hiện tại) (S1)
- [x] Fix thiếu revoke refresh token khi deactivate user: khi admin deactivate một tài khoản, các `RefreshToken` row trong DB của user đó không bị xoá. `JwtAuthGuard` check `isActive` nên access token mới fail, nhưng refresh token row vẫn tồn tại đến hết TTL 7 ngày — nên chạy `prisma.refreshToken.deleteMany({ where: { userId } })` sau khi update `isActive: false` (S2)
- [x] Thêm rate limiting cho admin write operations: `PATCH /admin/users/:id` và `PATCH /admin/events/:id/archive` không có rate limit riêng — global 60 req/min cho phép mass deactivation qua script với JWT admin bị compromise. Cần thêm `@Throttle` chặt hơn trên các endpoint này (S3)

**Admin module — unit & integration test gaps**

- [x] Unit tests cho `AdminService` — không có file `admin.service.spec.ts` nào, coverage = 0%; test plan yêu cầu ≥ 80% cho mọi API service (M1)
  - `getStats` — trả đúng `totalUsers`, `totalEvents`, `totalVnd` (kể cả khi 0 expense)
  - `getUsers` — pagination hoạt động đúng (skip/take), không lộ `passwordHash`
  - `updateUserStatus` — 404 khi không tìm thấy user, 400 khi target là ADMIN, happy path activate/deactivate
  - `getEvents` — excludes soft-deleted, member count chỉ đếm ACTIVE member
  - `archiveEvent` — 404 khi không tìm thấy, 400 khi đã ARCHIVED, happy path
- [x] Integration tests cho Admin endpoints dùng Supertest + Neon DB — không có file `admin.e2e-spec.ts` trong khi tất cả các module khác đều có (M2)
  - `GET /admin/stats` → 200 admin, 403 non-admin, 401 unauthenticated
  - `GET /admin/users` → 200 admin với pagination, 403, 401
  - `PATCH /admin/users/:id` → 200 deactivate, 400 target admin, 404, 403, 401
  - `GET /admin/events` → 200 admin với pagination, 403, 401
  - `PATCH /admin/events/:id/archive` → 200 archive, 400 already archived, 404, 403, 401

---

### Phase 4 — Connect UI to Data

**Goal:** Replace all static data in the UI with live API calls.

**API client setup**

- [x] Create typed fetch wrapper in `apps/web/lib/api.ts` (attaches JWT, handles 401 refresh)
- [x] Configure TanStack Query provider in the app root
- [x] Define typed query/mutation hooks per domain in `apps/web/lib/hooks/`

**API client setup — QA fixes**

- [x] Fix concurrent 401 race condition in `api.ts`: hai request cùng nhận 401 sẽ gọi `callRefresh()` song song — refresh token rotation khiến call thứ hai fail → logout nhầm. Cần dùng module-level `refreshPromise` singleton để dedup (F1, S3)
- [x] Fix `api.ts`: bỏ `Content-Type: application/json` khi không có body (GET, DELETE) — một số proxy reject GET request có Content-Type header (S1)
- [x] Fix `api.ts`: sau `window.location.href = '/login'` nên `return` ngay thay vì `throw` — tránh TanStack Query bắt lỗi và hiện error state trước khi navigation hoàn tất (F2)
- [x] Fix `api.ts`: thêm request timeout bằng `AbortController` (đề xuất 30s) — spec §5.9 yêu cầu PDF export hoàn thành trong 30s; hiện tại fetch có thể treo vô thời hạn (M5)
- [x] Fix `use-events.ts`: xác minh và đồng bộ `EventType` enum — code dùng `'DINING'` nhưng product spec §5.2 nói `'MEAL'`; cần kiểm tra Prisma schema và sửa type nếu sai (F3)
- [x] Fix `use-events.ts`: đổi `AddMemberPayload` thành discriminated union `{ email: string } | { nickname: string }` — hiện tại cả hai field đều optional, cho phép gọi với object rỗng gây 400 khó debug (M6)
- [x] Thêm `useVerifyEmail`, `useResetPassword`, `useResendVerification` vào `use-auth.ts` — ba hook này cần thiết để wire các trang verify email, reset password, và nút "Gửi lại email" (M2)
- [x] Thêm `useAcceptInvitation` hook — backend `POST /events/:id/invitations/:token/accept` đã có, page `invitations/[token]/accept/page.tsx` đã có, nhưng chưa có hook tương ứng (M1)
- [x] Fix `use-auth.ts` `useLogout`: thêm `onSuccess: () => qc.clear()` để xoá toàn bộ query cache sau khi logout — tránh data của user cũ hiển thị nếu user khác đăng nhập trên cùng tab (M3)
- [x] Fix `use-messages.ts`: đổi `useMessages` sang `useInfiniteQuery` để hỗ trợ "load older messages" — `useQuery` với cursor hiện tại thay thế data mỗi lần cursor thay đổi, làm mất tin nhắn đang hiển thị (M4)
- [x] Fix `api.ts`: thêm cảnh báo build-time hoặc runtime khi `NEXT_PUBLIC_API_URL` không được set — hiện tại fallback về `http://localhost:4000` âm thầm trong production (S2)

**Auth**

- [x] Wire login form → `POST /auth/login` → redirect to dashboard on success
- [x] Wire register form → `POST /auth/register` → show "check your email" screen
- [x] Wire forgot password form → `POST /auth/forgot-password`
- [x] Protect `(app)` routes: redirect to `/login` if no valid session
- [x] Protect `/admin` routes: redirect to `/dashboard` if not Admin

**Auth — QA fixes**

- [x] Fix middleware `getRoleFromAccessToken`: thiếu base64 padding trước khi gọi `atob()` — JWT payload là base64url không có `=`; Edge Runtime `atob()` ném `DOMException`; `try/catch` silently trả `null`; guard `if (role !== null && role !== 'ADMIN')` không bao giờ fire → non-admin user có `access_token` hợp lệ vẫn qua được admin route và thấy admin shell. Cần thêm padding: `base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')` trước khi decode (F1 — critical)
- [x] Fix `check-email/page.tsx`: hiển thị cứng "15 phút" nhưng `VERIFICATION_TOKEN_TTL_HOURS = 24` trong `auth.service.ts` — người dùng tưởng link hết hạn sau 15 phút, bỏ email hợp lệ và resend không cần thiết. Sửa thành "24 giờ" (F2)
- [x] Fix `AppLayout`: thay `<a href="...">` bằng Next.js `<Link>` cho cả hai nav link `/dashboard` và `/admin` — `<a>` gây full page reload mỗi lần navigate, huỷ toàn bộ TanStack Query cache và React component state (F3)
- [x] Wire Google OAuth button ở trang login và register — nút "Tiếp tục với Google" hiện `type="button"` không có `onClick` handler, click không có tác dụng; spec §5.1 yêu cầu "User can log in with Google OAuth" — acceptance criterion hoàn toàn chưa được đáp ứng (F4)
- [x] Thêm `<Suspense>` wrapper cho `useSearchParams()` trong `check-email/page.tsx` — Next.js App Router yêu cầu điều này cho Client Component; thiếu wrapper gây build warning và flash UI branch "Quay lại đăng ký" sai trước khi hydrate với email từ URL (M1)
- [x] Thêm logout button/user menu vào `AppLayout` — `useLogout` hook đã tồn tại và clear query cache đúng, nhưng không có UI nào trong app shell để gọi nó; người dùng không có cách đăng xuất (M2)
- [x] Redirect user đã có session ra khỏi auth pages `/login`, `/register` — middleware chỉ guard `(app)` routes, không block người dùng đã đăng nhập quay lại auth forms; nên kiểm tra cookie và redirect về `/dashboard` nếu đã có session (M3)
- [x] Fix `api.ts`: lưu `window.location.pathname` vào `sessionStorage` làm `returnUrl` trước khi redirect sang `/login` khi nhận 401 → sau khi re-auth, dùng `returnUrl` để quay lại đúng trang thay vì luôn về `/dashboard` (S1)
- [x] Ẩn địa chỉ email khỏi URL query param ở check-email page — `/check-email?email=user@example.com` lộ email vào browser history, server access logs và `Referer` header; nên truyền qua `router.push` với `state` object hoặc lưu vào `sessionStorage` trước khi navigate (S2)

**Dashboard & events**

- [x] Dashboard fetches and renders real event list
- [x] Create Event form submits → redirects to new event detail page
- [x] Event detail fetches event data and member list

**Dashboard & events — QA fixes**

- [x] Fix members page: thêm xử lý `isError` — khi API lỗi, trang hiện tại render im lặng "0 thành viên" thay vì hiển thị thông báo lỗi (F1 — 🔴 high)
- [x] Fix SETTLED badge: layout.tsx dùng `variant: 'warning'` nhưng `StatusBadge` component dùng `variant: 'outline'` — cần thống nhất một trong hai (F2 — 🔴 high)
- [x] Fix Create Event: thêm cảnh báo UI khi ảnh bìa được chọn nhưng sẽ không được upload (Cloudinary chưa implement) — hiện tại ảnh bị bỏ qua im lặng, người dùng không biết (F3 — 🟠 medium)
- [x] Fix members page: thêm `.catch()` cho `navigator.clipboard.writeText()` — nếu clipboard bị từ chối (HTTP hoặc permission denied), lỗi bị nuốt im lặng không có feedback (F4 — 🟠 medium)
- [x] Fix members page: thêm skeleton loading trong card invite link trong khi `inviteData` đang load — hiện tại hiển thị ký tự `…` thay vì Skeleton component đồng bộ với phần còn lại của trang (F5 — 🟡 low)
- [x] Fix event layout: ẩn/disable tab bar khi event ở trạng thái lỗi (404/403) — hiện tại tabs vẫn render và có thể click khi event không tìm thấy (F6 — 🟡 low)

**Expenses**

- [x] Expense list fetches real expenses for the event
- [x] Add Expense form submits with correct split payload
- [x] Edit and delete actions wired up with optimistic UI updates
- [x] Receipt photo: upload to Cloudinary via signed URL before form submit

**Expenses — QA fixes**

- [x] Fix `page.tsx`: thêm class `group` vào div row của từng expense — div wrapper `<div className="flex items-center justify-between ...">` không có `group`, khiến `group-hover:opacity-100` trên div chứa nút edit/delete không bao giờ fire; cả hai nút bị kẹt ở `opacity-0` vĩnh viễn, không thể nhìn thấy hay click (F1 — 🔴 critical)
- [x] Fix `page.tsx`: thêm `try/catch` vào `handleSubmit` và `handleDelete` để hiển thị `toast.error` khi API call thất bại — hiện tại khi mutateAsync throw, optimistic update rollback xảy ra im lặng, người dùng không biết thao tác thất bại hay thành công (F2 — 🔴 critical)
- [x] Fix `page.tsx`: ẩn nút edit/delete với các expense mà user không có quyền — spec §5.3 chỉ expense creator hoặc organizer mới được sửa/xoá; hiện tại mọi member đều thấy nút, API sẽ trả 403 nhưng không có error toast (F2) nên user hoàn toàn bị bỏ qua (F3 — 🟠 high)
- [x] Fix `page.tsx`: áp dụng `disabled={isBusy}` cho nút edit (pencil) và nút trigger xoá (trash icon) trên từng row — `isBusy` đã được tính nhưng chỉ dùng cho nút "Thêm chi phí" ở trên, các nút hành động từng row vẫn clickable khi đang có mutation in-flight (M2 — 🟡 medium)
- [x] Fix `page.tsx`: thay `window.location.reload()` trong error state bằng `qc.invalidateQueries(expenseKeys.list(id))` — full reload huỷ toàn bộ TanStack Query cache của app (event detail, members, các tab khác) không cần thiết; pattern nhất quán với dashboard (S3 — 🟡 medium)
- [x] Fix `add-expense-dialog.tsx`: kiểm tra MIME type của file khi chọn ảnh hoá đơn — `handleReceiptChange` chỉ validate `file.size`, không validate `file.type`; user có thể đặt tên file `.jpg` cho bất kỳ định dạng nào và bypass `accept` attribute; nên reject nếu `file.type` không thuộc `['image/jpeg', 'image/png', 'image/heic', 'image/heif']` (M1 — 🟡 medium)
- [x] Fix `add-expense-dialog.tsx`: hiển thị nút edit/delete luôn visible trên mobile thay vì dùng hover-reveal — pattern `opacity-0 group-hover:opacity-100` không hoạt động trên touch device; spec §8 yêu cầu "fully usable on 375px viewport (iOS Safari, Android Chrome)" (M5 — 🟡 medium)
- [x] Fix `use-expenses.ts`: truyền `members` list vào optimistic create để resolve nickname payer thực — hiện tại temporary expense hiển thị `nickname: '…'` cho payer cho đến khi query re-fetch xong (M3 — 🟢 low)
- [x] Fix `add-expense-dialog.tsx`: hiển thị error message inline trong dialog khi submit thất bại — hiện tại nếu `onSubmit` throw, dialog giữ nguyên nhưng không có thông báo lỗi nào bên trong, chỉ có thể kết hợp với F2 fix để show toast ở ngoài (M4 — 🟢 low)
- [x] Fix `use-upload.ts`: huỷ in-flight upload trước khi bắt đầu upload mới khi user chọn lại file — nếu user thay file nhanh, nhiều signed param được fetch và nhiều file được POST lên Cloudinary tạo orphaned assets (S2 — 🟢 low)

**Balances**

- [x] Balance tab fetches `/balances` endpoint and renders simplified transaction list
- [x] Live recalculates after any expense create/edit/delete

**Balances — QA fixes**

- [x] Fix `balances/page.tsx`: thêm nút "Thử lại" vào error state — hiện tại chỉ render text "Vui lòng thử lại" không có action nào; so sánh với expenses page đã có `onClick={() => void qc.invalidateQueries(expenseKeys.list(id))}` (M2 — 🟠 medium)

**Expenses — QA fixes (Round 2)**

- [x] Fix `add-expense-dialog.tsx`: không thể xoá ảnh hoá đơn khi chỉnh sửa expense — khi user click "Xoá ảnh" trong edit mode, `uploadedReceiptUrl` được set thành `null` nhưng `handleSubmit` gửi `...(uploadedReceiptUrl ? { receiptUrl } : {})` nên `receiptUrl` bị omit hoàn toàn; backend `updateExpense` chỉ patch khi `!== undefined`, khiến ảnh cũ vẫn còn trong DB. Cần truyền `receiptUrl: null` tường minh để clear (M1 — 🟠 medium)

**Backend — QA fixes**

- [ ] Fix `expenses.service.ts` `createExpense()`: thiếu guard `SETTLED`/`ARCHIVED` — hàm select `status` từ DB nhưng không bao giờ kiểm tra giá trị đó; member có thể thêm expense mới vào event đã chốt; `updateExpense` và `deleteExpense` đã có guard đúng ở line 68 và 115 nhưng `createExpense` thì không. Cần thêm guard tương tự ngay sau khi kiểm tra `!event` (F4 — 🔴 critical)

**Settlements**

- [ ] Settlement list fetches real data with status badges
- [ ] Record Settlement form submits and shows PENDING entry immediately
- [ ] Confirm and reject buttons wired to API; balance view updates after confirm

**Settlements — QA fixes**

- [ ] Fix `use-settlements.ts`: đổi `'BANK_TRANSFER'` → `'OTHER'` trong `PaymentMethod` type — Prisma schema định nghĩa `enum SettlementMethod { MOMO VNPAY CASH OTHER }`, không có `BANK_TRANSFER`; giá trị này sẽ gây Prisma validation error khi được gửi lên backend (M3 — 🟠 medium)
- [ ] Fix `record-settlement-dialog.tsx`: thêm MoMo/VNPay deep-link khi chọn phương thức tương ứng — spec §5.6 yêu cầu "selecting MoMo or VNPay generates a tappable deep-link pre-filled with the correct amount"; backend util `payment-deeplinks.ts` đã có nhưng không có path nào gọi đến nó từ frontend; cần render link/QR tappable ngay dưới payment method selector (F3 — 🟠 high)
- [ ] Fix `record-settlement-dialog.tsx`: thêm validation MIME type cho file proof — `handleProofChange` chỉ kiểm tra `file.size`, không kiểm tra `file.type`; khác với expense dialog đã fix ở entry 163; file được rename tuỳ ý sẽ bypass `accept` attribute và được gửi mà không qua guard (M4 — 🟠 medium)
- [ ] Fix `record-settlement-dialog.tsx`: upload proof screenshot lên Cloudinary trước khi submit — dialog hiện chỉ track `hasProof: boolean` từ local state; không có `useCloudinaryUpload` call; khi settlements page được wire vào API, `proofUrl` sẽ luôn là `null/undefined`; cần dùng cùng pattern với `add-expense-dialog.tsx` (M4 — 🟠 medium)
- [ ] Thêm UI confirm và reject cho PENDING settlement — settlements page hiển thị danh sách nhưng không có nút "Xác nhận" (cho người nhận) hay "Từ chối" (cho organizer/người nhận); spec §5.5 yêu cầu recipient hoặc organizer có thể confirm, và organizer hoặc recipient có thể reject; `useConfirmSettlement` và `useDeleteSettlement` đã có trong hook nhưng chưa được gọi (F4 — 🔴 critical)

**Reminders**

- [ ] Send Reminder button (organizer only) calls notifications API
- [ ] Shows "last reminded at …" from API response
- [ ] Disables button with countdown if within 24h rate limit window

**Chat**

- [ ] On mount, connect to Socket.io room for the event
- [ ] Fetch message history via REST on load
- [ ] Send message over WebSocket; append to list on `newMessage` event
- [ ] Fall back to polling if WebSocket connection fails

**Chat — QA fixes**

- [ ] Fix `chat/page.tsx`: dùng `api.ts` wrapper thay vì raw `fetch()` — `apiFetchMessages`, `apiPostMessage`, `apiGetMe` bypass timeout 30 giây của `api.ts`, không có retry cycle khi token hết hạn (401 không tự refresh), và lỗi session hiển thị chuỗi `'auth-failed'` không redirect về `/login` (S2 — 🟠 medium)
- [ ] Fix `chat/page.tsx`: thêm `maxLength` attribute vào chat `<Input>` — backend và WebSocket gateway enforce 2000 ký tự nhưng input không có giới hạn client-side; người dùng gõ quá 2000 ký tự sẽ chỉ nhận lỗi từ server mà không có cảnh báo trước (M6 — 🟡 low)
- [ ] Fix `chat/page.tsx`: xoá hằng số `API` hardcode — `const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'` trùng với logic trong `api.ts`; nếu env var thay đổi, chat page có thể bị bỏ sót (S2 — 🟡 low)

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
- [ ] Register: required fields, valid email, password min 8 chars, passwords match — **lưu ý:** form register hiện thiếu cả trường "confirm password" lẫn kiểm tra độ dài tối thiểu ở client; người dùng nhập sai password không phát hiện ra cho đến khi đăng nhập thất bại
- [ ] Add `@MaxLength` to backend DTOs: `name` ≤ 100 chars, `password` ≤ 128 chars — no upper bounds currently; omitting lets attackers force bcrypt to process oversized input (M8)
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
