# Change Log — Titra

All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

---

## 2026-05-24 (26) — Phase 2: Shared components — Loading skeleton

**Files created:**
- `apps/web/components/ui/skeleton.tsx`: base `Skeleton` primitive — a `<div>` with `animate-pulse bg-muted rounded-md` and an optional `className` prop. Follows the shadcn/ui pattern.
- `apps/web/components/ui/skeletons.tsx`: composed page-level skeleton components for all data-heavy pages:
  - `EventCardsSkeleton` — grid of event card placeholders (count prop, default 3)
  - `ExpenseListSkeleton` — list rows with description + badge + meta + amount (rows prop, default 4)
  - `BalanceSkeleton` — net-position rows with avatar circles + simplified transaction rows (memberCount prop)
  - `SettlementListSkeleton` — settlement rows with status badge placeholder (rows prop, default 3)
  - `ChatSkeleton` — alternating incoming/outgoing chat bubble placeholders + pinned input bar
  - `AdminStatsSkeleton` — three stat card placeholders matching the admin layout
  - `AdminTableSkeleton` — full `<table>` with thead and tbody rows (rows + cols props, defaults 5/4); first column gets stacked double-line, last column gets a right-aligned button placeholder

---

## 2026-05-24 (25) — Phase 2: Admin dashboard — Event table

**Files changed:**
- `apps/web/app/(app)/admin/page.tsx`: added **Sự kiện** section below the user table. Table columns: event name + organizer (stacked), status badge (**Đang diễn ra** green / **Đã huề** outline / **Đã lưu trữ** secondary), member count, and an **"Lưu trữ"** action button. Archive button is hidden on already-ARCHIVED rows; clicking it sets the event's status to `ARCHIVED` in local state. Mock seed: 5 events (3 ACTIVE, 1 SETTLED, 1 pre-ARCHIVED).

---

## 2026-05-24 (24) — Phase 2: Admin dashboard — User table

**Files changed:**
- `apps/web/app/(app)/admin/page.tsx`: converted from server to client component (needed for Deactivate toggle). Added a **Người dùng** section below the stats cards with a full-width `<table>` showing: name + email (stacked), role badge (**Quản trị** / **Người dùng**), status badge (**Hoạt động** in outline / **Đã vô hiệu** in destructive red), formatted registration date (dd/mm/yyyy), and an action button. **Deactivate/Activate button** toggling `ACTIVE ↔ INACTIVE` in local state; hidden for ADMIN-role users to prevent self-lockout. Mock seed: 6 users (1 admin + 5 regular, one pre-set to INACTIVE).

---

## 2026-05-24 (23) — Phase 2: Admin dashboard — Stats cards

**Files created:**
- `apps/web/app/(app)/admin/page.tsx`: admin overview page with three stat cards — **Tổng người dùng** (128, with +12 in last 30 days note), **Tổng sự kiện** (47, broken down into active/settled), **Tổng VNĐ theo dõi** (12.450.000 ₫, across all events). Each card uses a two-row layout: icon + label row, then large bold value + description row. Static/mock data (replaced by API in Phase 4). Server component.

**Files changed:**
- `apps/web/app/(app)/layout.tsx`: added "Quản trị" nav link pointing to `/admin` so the page is reachable from the app shell.

---

## 2026-05-24 (22) — Phase 2: Invite link display with Copy button

**Files changed:**
- `apps/web/app/(app)/events/[id]/members/page.tsx`: added an invite link card above the member list. A `useEffect` sets `inviteUrl` to `window.location.origin + /join/<token>` after mount (avoiding SSR mismatch; shows `…` placeholder during hydration). Mock tokens keyed by event ID (`inv_1a2b3c4d5e6f` for event 1, `inv_9z8y7x6w5v4u` for event 2). Copy button calls `navigator.clipboard.writeText`; on success flips the icon to a green Check and label to "Đã sao chép" for 2 seconds, then resets.

---

## 2026-05-24 (21) — Phase 2: Members tab

**Files changed:**
- `apps/web/app/(app)/events/[id]/members/page.tsx`: replaced stub with a full stateful client component. Each row shows an avatar initial bubble, member name (with "(bạn)" suffix for the current user), a role badge (Ban tổ chức / Thành viên / Khách), and the member's email when available. Role badge uses `default` variant for organizer, `secondary` for member, `outline` for guest. **Remove button**: shown only when the current user is the organizer, only on non-organizer members, and never on the current user's own row. Clicking opens a confirmation `Dialog` explaining that the member's existing expenses are preserved. Confirming filters the member from local state. Seed data for events `1` (6 members: 1 organizer, 3 members, 2 guests) and `2` (7 members).

---

## 2026-05-24 (20) — Phase 2: Chat tab

**Files changed:**
- `apps/web/app/(app)/events/[id]/chat/page.tsx`: replaced stub with a full stateful client component. Layout: a bordered container occupying remaining viewport height (`calc(100vh - 22rem)`), split into a scrollable message area (flex-1) and a pinned input bar at the bottom. **Message list**: messages ordered chronologically with date-separator dividers between days. Others' messages appear on the left with an avatar initial bubble (hidden when consecutive messages from the same sender); the simulated current user's messages appear right-aligned in a dark bubble. Consecutive messages from the same sender share the avatar slot (hidden but space preserved for alignment). **Auto-scroll**: jumps to the bottom instantly on mount; smooth-scrolls on each new message. **Send**: Enter key or Send icon button appends the message with the current timestamp; button disabled when input is empty. **Empty state**: centered MessageCircle icon with Vietnamese prompt. Seed data for events `1` (7 messages across 2 days) and `2` (4 messages).

---

## 2026-05-24 (19) — Phase 2: Record Settlement form

**Files created:**
- `apps/web/components/features/record-settlement-dialog.tsx`: Dialog for recording a new settlement. Fields: **Người trả** — pill selector for the payer; **Trả cho** — pill selector for the recipient (inline error if payer = recipient); **Số tiền** — VND integer input with formatted preview; **Hình thức thanh toán** — pill toggle: MoMo / VNPay / Tiền mặt / Khác; **Proof upload** — dashed drop zone for JPG/PNG/HEIC ≤ 5 MB with filename display and remove button. Submit button disabled until all required fields are valid.

**Files changed:**
- `apps/web/app/(app)/events/[id]/settlements/page.tsx`: converted to a stateful client component. Added "Ghi nhận thanh toán" button (in header row when settlements exist, and in empty-state CTA). Wired `RecordSettlementDialog`; new settlements are appended with status `PENDING`. Member lists added for events `1` and `2`.

---

## 2026-05-24 (18) — Phase 2: Settlements tab

**Files changed:**
- `apps/web/app/(app)/events/[id]/settlements/page.tsx`: replaced stub with a full client component. Displays a list of settlements with PENDING / CONFIRMED status badges. Each row shows payer → recipient, status badge (yellow clock for PENDING, green checkmark for CONFIRMED), payment method (MoMo / VNPay / Tiền mặt / Khác), proof screenshot indicator, date, and amount. Summary line at the top shows total count and number confirmed. Empty state shows a Handshake icon with a message when there are no settlements. Static seed data for events `1` and `2`.

---

## 2026-05-24 (17) — Phase 2: Balances tab

**Files changed:**
- `apps/web/app/(app)/events/[id]/balances/page.tsx`: replaced stub with a full client component. Runs the minimum-cash-flow balance algorithm against the same mock expense and member data used by the expenses tab. **Net positions section**: each member row shows an avatar initial, name, and their net balance (green + TrendingUp icon when owed money, red + TrendingDown when owing money, muted Minus when even). Amounts displayed rounded to the nearest 1,000 ₫. **"Ai cần trả ai" section**: simplified transaction list showing "X → Y: Z ₫" pairs — the minimum number of payments needed to settle the group. **All-settled empty state**: when all balances are zero, shows a PartyPopper icon and "Mọi người đã huề cả làng 🎉".

---

## 2026-05-24 (16) — Phase 2: Add Expense form

**Files created:**
- `apps/web/components/features/add-expense-dialog.tsx`: Dialog-based Add Expense form. Fields: description (required), amount (VND integer, formatted display below input), category (pill toggle: Ăn uống / Di chuyển / Lưu trú / Vui chơi / Khác), payer (pill toggle per member). Split mode via Tabs: **Chia đều** — member checkboxes with live per-person amount (remainder goes to first selected member, shown inline); **Tùy chỉnh** — per-member amount inputs with running total that turns red when it doesn't match the expense amount. Receipt photo upload: dashed-border drop zone, accepts JPG/PNG/HEIC up to 5 MB with size validation and filename display. Submit button disabled until form is valid.

**Files changed:**
- `apps/web/app/(app)/events/[id]/expenses/page.tsx`: converted static expense array to `useState` (seeded with mock data). "Thêm chi phí" buttons (header and empty state) now open the dialog. `handleAdd` appends new expenses to local state. Added `MOCK_MEMBERS` per event ID to supply to the dialog.

---

## 2026-05-24 (15) — Phase 2: Expenses tab

**Files changed:**
- `apps/web/app/(app)/events/[id]/expenses/page.tsx`: replaced stub with a full client component. Shows a header row with expense count and total VND; a bordered, divided list of expenses where each row displays description, category chip (Ăn uống / Di chuyển / Lưu trú / Vui chơi / Khác), payer name, date, and amount (right-aligned, tabular numbers). "Thêm chi phí" button in the header. Empty state (Receipt icon + message + CTA) when no expenses exist. Static mock data keyed by event ID (replaced by API in Phase 4).

---

## 2026-05-24 (14) — Review fix: Event shell with tab navigation

**Issues found and fixed in `apps/web/app/(app)/events/[id]/layout.tsx`:**
1. **WCAG 2.1 AA — missing `aria-label` on `nav`** — the page contains two `nav` elements (app header nav + tab nav); without a label, screen readers announce both as "navigation" with no way to distinguish them. Fixed: added `aria-label="Tab điều hướng sự kiện"` to the tab nav.
2. **WCAG 2.1 AA — missing `aria-current` on active tab** — SC 4.1.2 requires that the current state of a navigation item be conveyed to assistive technology. Fixed: added `aria-current="page"` to the active tab link, `undefined` (omitted) on inactive ones.

---

## 2026-05-24 (13) — Phase 2: Event shell with tab navigation

**Files created:**
- `apps/web/app/(app)/events/[id]/layout.tsx`: client component — event header (name, description, member count, type + status badges) with a back link to the dashboard; link-based tab nav for Chi phí · Số dư · Thanh toán · Trò chuyện · Thành viên; active tab highlighted via `usePathname()`. Uses mock event data keyed by `[id]` (replaced by API in Phase 4).
- `apps/web/app/(app)/events/[id]/page.tsx`: redirects to `/events/[id]/expenses`.
- `apps/web/app/(app)/events/[id]/expenses/page.tsx`: stub placeholder.
- `apps/web/app/(app)/events/[id]/balances/page.tsx`: stub placeholder.
- `apps/web/app/(app)/events/[id]/settlements/page.tsx`: stub placeholder.
- `apps/web/app/(app)/events/[id]/chat/page.tsx`: stub placeholder.
- `apps/web/app/(app)/events/[id]/members/page.tsx`: stub placeholder.

---

## 2026-05-24 (12) — Review fix: Create event form

**Issues found and fixed in `apps/web/app/(app)/events/new/page.tsx`:**
1. **Memory leak** — `URL.createObjectURL` result was never revoked. Fixed: added `objectUrlRef` to track the active URL; revoked on image swap inside `handleFileChange`, on remove inside `removeCover`, and on component unmount via `useEffect` cleanup.
2. **`accept` attribute vs hint mismatch** — file input accepted `image/heic` but the visible hint said "JPG, PNG" only. HEIC files also cannot be rendered by browsers as `<img>` previews. Fixed: removed `image/heic` from `accept`; input now accepts `image/jpeg,image/png` only, consistent with the hint.
3. **"tối đa 5 MB" not enforced** — hint promised a 5 MB limit but no validation existed. Fixed: added `MAX_COVER_SIZE` constant and a size check in `handleFileChange`; files over 5 MB clear the input and show a `coverError` message in red below the upload zone.

---

## 2026-05-24 (11) — Phase 2: Create event form

**Files changed:**
- `apps/web/app/(app)/events/new/page.tsx`: new client component — form with controlled state for name (text input, required), event type (3-option button toggle: Chuyến đi / Bữa ăn / Khác), description (textarea, optional), and cover photo (file input with live image preview + remove button). Submit button disabled until name is non-empty. Cancel link returns to `/dashboard`. No API call yet (wired in Phase 4).

---

## 2026-05-24 (10) — Phase 2: Dashboard empty state

**Files changed:**
- `apps/web/app/(app)/dashboard/page.tsx`: added empty state branch — when `MOCK_EVENTS` is empty, renders a dashed-border panel with a MapPin icon, heading "Bạn chưa có chuyến đi nào", a short description, and a "Tạo chuyến đi đầu tiên" CTA button. The existing event grid renders when events are present.

---

## 2026-05-24 (9) — Phase 2: Event list page (dashboard)

**Files changed:**
- `apps/web/app/(app)/dashboard/page.tsx`: replaced placeholder with a grid of event cards. Each card shows event name, description, type badge (Chuyến đi / Bữa ăn / Khác), status badge (Đang diễn ra / Đã huề / Đã lưu trữ), member count, and date. "Tạo chuyến đi" button in the header. "Xem chi tiết" link per card. Static/hardcoded data (3 mock events). No API calls yet.

---

## 2026-05-24 (8) — Phase 2: Email sent confirmation screen

**Files changed:**
- `apps/web/app/(auth)/check-email/page.tsx`: created static email confirmation screen — envelope icon, "Kiểm tra email của bạn" heading, description prompting user to check inbox/spam, 15-minute expiry notice, "Gửi lại email" button linking back to forgot-password, link to login. Server component (no interactivity needed). Matches the auth layout pattern.

---

## 2026-05-24 (7) — Phase 2: Forgot password page

**Files changed:**
- `apps/web/app/(auth)/forgot-password/page.tsx`: created forgot password page — email input field, "Gửi liên kết đặt lại mật khẩu" submit button, link back to login. Client component matching the login/register pattern. No API calls yet.

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
