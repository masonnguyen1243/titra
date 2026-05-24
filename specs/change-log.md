# Change Log — Titra

All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

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
