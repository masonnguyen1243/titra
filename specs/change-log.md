# Change Log — Titra

All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

---

## 2026-05-25 (46) — Phase 3: Auth — Google OAuth login via Passport (M1)

**Files changed:**
- `apps/api/prisma/schema.prisma`: Added `googleId String? @unique` to the `User` model.
- `apps/api/prisma/migrations/20260525_add_google_id_to_users/migration.sql`: Migration SQL for the new column and unique index.
- `apps/api/src/auth/strategies/google.strategy.ts`: New `GoogleStrategy` extending `PassportStrategy(Strategy, 'google')`. Reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_API_URL` from env. Extracts `googleId`, `email`, `name`, and `avatarUrl` from the Google profile and passes them as a typed `GoogleProfile` object.
- `apps/api/src/auth/guards/google-auth.guard.ts`: New `GoogleAuthGuard` extending `AuthGuard('google')`.
- `apps/api/src/auth/auth.service.ts`: Added `googleLogin(profile, res)`. Looks up user by `googleId` OR `email` (handles account linking). Creates a new user if none exists (`emailVerified: true` since Google already verified it). Updates existing email-only account to set `googleId`. Rejects inactive accounts. Issues JWT pair via HttpOnly cookies and returns the user profile.
- `apps/api/src/auth/auth.controller.ts`: Added `GET /auth/google` (redirect to Google) and `GET /auth/google/callback` (receives profile, calls `googleLogin`, redirects to `/dashboard` on success or `/login?error=oauth_failed` on failure).
- `apps/api/src/auth/auth.module.ts`: Imported `PassportModule` and registered `GoogleStrategy` as a provider.
- `apps/api/package.json`: Added `@nestjs/passport`, `passport`, `passport-google-oauth20` (runtime) and `@types/passport`, `@types/passport-google-oauth20` (dev).

---

## 2026-05-25 (45) — Phase 3: Auth QA fix — RegisterDto rejects empty name (M7)

**Files changed:**
- `apps/api/src/auth/dto/register.dto.ts`: Added `@IsNotEmpty()` decorator to the `name` field (alongside the existing `@IsString()`). Previously, `name: ""` passed validation and was written to the database. The global `ValidationPipe` enforces the constraint at the HTTP boundary, so no service changes were needed.

---

## 2026-05-25 (44) — Phase 3: Auth QA fix — forgotPassword() skips unverified accounts (M11)

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `emailVerified` to the `select` in `forgotPassword()`. Extended the early-return guard from `!user || !user.isActive` to also include `!user.emailVerified`. Unverified accounts now silently receive `{ ok: true }` without generating a token or sending an email — consistent with the enumeration-safe pattern already used for unknown/inactive users.
- `apps/api/src/auth/auth.service.spec.ts`: Added `emailVerified: true` to the `activeUser` fixture (required now that the field is selected). Added one new test: `emailVerified: false` → returns `{ ok: true }`, `update` not called. Total tests: 27, all passing.

Also ran `prisma generate` to resolve stale client errors on `passwordResetExpiry` that surfaced during typecheck.

---

## 2026-05-25 (43) — Phase 3: Auth QA fix — GET /auth/health returns 503 when degraded (F3)

**Files changed:**
- `apps/api/src/auth/auth.controller.ts`: Replaced the static `@HttpCode(HttpStatus.OK)` on the `health` endpoint with dynamic status code logic. The controller now awaits `authService.health()` and calls `res.status(503)` before returning the body when `result.status === 'degraded'`. Previously the endpoint always returned 200 regardless of DB or JWT config failures, preventing load balancers from detecting the degraded state.

---

## 2026-05-25 (42) — Test fix: auth.service.spec.ts updated for F1 + F2

**Issue:** After F1 and F2 changes, the test suite had 1 failure and 2 missing cases.

**Failures fixed:**
- `resetPassword` happy-path mock was missing `isActive: true` — the new guard caused it to throw 400. Fixed all `resetPassword` mocks to include `isActive`.

**Missing tests added:**
- `login()` with `isActive: false` → 401 and bcrypt **not called** (verifies F1 skips bcrypt for inactive accounts).
- `resetPassword()` with `isActive: false` → 400 and `update` not called (verifies F2 blocks deactivated users).

**Result:** 26 tests, all passing.

---

## 2026-05-25 (41) — Phase 3: Auth QA fix — resetPassword() checks isActive (F2)

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `isActive` to the `select` in `resetPassword()`. Combined the existence + active check into a single guard: `if (!user || !user.isActive)` returns the generic 400 "Liên kết đặt lại mật khẩu không hợp lệ". Previously, a deactivated user could still consume a valid reset token issued before deactivation and regain account access within the 1h TTL window.
- Ran `npx prisma generate` to resolve a stale Prisma client that did not expose `passwordResetExpiry` in `UserSelect`.

---

## 2026-05-25 (40) — Phase 3: Auth QA fix — login() checks isActive before bcrypt (F1)

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Reordered `login()` checks. `isActive` is now verified **before** `bcrypt.compare`. If the user does not exist or is inactive, the method immediately throws the same generic `UnauthorizedException('Email hoặc mật khẩu không đúng')` without running bcrypt. Previously, a caller who supplied the correct password for a deactivated account received the distinct error "Tài khoản đã bị vô hiệu hoá" — leaking both account existence and password correctness. The new order: (1) find user, (2) check `isActive`, (3) bcrypt compare, (4) check `emailVerified`.

---

## 2026-05-24 (39) — Phase 3: Auth module — GET /auth/health

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `health()` — runs `SELECT 1` against the DB via Prisma and checks that both `JWT_SECRET` and `JWT_REFRESH_SECRET` env vars are set; returns `{ status, checks: { database, jwtConfig }, timestamp }`. Status is `"ok"` when both checks pass, `"degraded"` otherwise.
- `apps/api/src/auth/auth.controller.ts`: Added `GET /auth/health` handler; decorated with `@Get('health') @HttpCode(200)`. Inherits `@Public()` from the class so no JWT is required.

Also regenerated the Prisma client (`npx prisma generate`) to fix pre-existing type errors where `passwordResetToken` / `passwordResetExpiry` were missing from the generated types.

---

## 2026-05-24 (38) — Phase 3: Auth module — JWT auth guard + role guard

**Files changed:**
- `apps/api/src/auth/types/jwt-payload.interface.ts` *(new)*: `JwtPayload` interface `{ sub, email, role: UserRole }` shared by guards and decorators.
- `apps/api/src/auth/decorators/public.decorator.ts` *(new)*: `@Public()` metadata decorator; sets `IS_PUBLIC_KEY` so `JwtAuthGuard` skips the route.
- `apps/api/src/auth/decorators/roles.decorator.ts` *(new)*: `@Roles(...UserRole[])` metadata decorator; sets `ROLES_KEY` consumed by `RolesGuard`.
- `apps/api/src/auth/decorators/current-user.decorator.ts` *(new)*: `@CurrentUser()` param decorator; extracts `request.user: JwtPayload` for use in controller methods.
- `apps/api/src/auth/guards/jwt-auth.guard.ts` *(new)*: `JwtAuthGuard` — reads `access_token` HttpOnly cookie, skips if `@Public()`, validates JWT with `JWT_SECRET`, attaches payload to `request.user`; throws 401 if missing or expired.
- `apps/api/src/auth/guards/roles.guard.ts` *(new)*: `RolesGuard` — reads `@Roles()` metadata; if present, checks `request.user.role` is in the allowed list; throws 403 otherwise.
- `apps/api/src/auth/auth.module.ts`: Exports `JwtAuthGuard`, `RolesGuard`, and `JwtModule` so other modules can inject them.
- `apps/api/src/app.module.ts`: Registers `JwtAuthGuard` and `RolesGuard` as global `APP_GUARD` providers, protecting all routes by default.
- `apps/api/src/auth/auth.controller.ts`: Added `@Public()` at class level so all auth endpoints remain accessible without a token.
- `apps/api/src/health/health.controller.ts`: Added `@Public()` at class level for the health-check endpoint.

**Behaviour:**
- Every route requires a valid `access_token` cookie unless decorated with `@Public()`.
- `@Roles(UserRole.ADMIN)` on a controller/handler restricts access to ADMIN users; non-admin callers receive 403.
- Event-level ORGANIZER/MEMBER authorization will be added per-handler in the events/expenses modules using the same `@CurrentUser()` + service-level checks pattern.

---

## 2026-05-24 (37) — Phase 3: Auth module — POST /auth/reset-password

**Files changed:**
- `apps/api/src/auth/dto/reset-password.dto.ts` *(new)*: `ResetPasswordDto` with `token` (`@IsString @IsNotEmpty`) and `password` (`@MinLength(8)`) fields.
- `apps/api/src/auth/auth.service.ts`: Added `resetPassword()` — looks up user by `passwordResetToken` (unique index); throws 400 if not found; throws 400 if `passwordResetExpiry` is null or in the past; hashes the new password with bcrypt (12 rounds); updates user with new `passwordHash` and nulls out both reset token fields; returns `{ ok: true }`.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/reset-password` route using `@Body() ResetPasswordDto`, returns 200.
- `apps/api/src/auth/auth.service.spec.ts`: Added `resetPassword` describe block with 4 cases: valid token → password hashed and token cleared; unknown token → 400; expired token → 400; null expiry → 400.

All 24 auth service tests pass. Ran `npx prisma generate` to ensure Prisma client reflects `passwordResetToken @unique` in `UserWhereUniqueInput`.

---

## 2026-05-24 (36) — Phase 3: Auth module — POST /auth/forgot-password

**Files changed:**
- `apps/api/prisma/schema.prisma`: Added `passwordResetToken String? @unique` and `passwordResetExpiry DateTime?` fields to `User` model.
- `apps/api/prisma/migrations/20260524_add_password_reset_to_user/migration.sql` *(new)*: `ALTER TABLE "users"` adds `passwordResetToken` (unique, nullable) and `passwordResetExpiry` (nullable) columns.
- `apps/api/src/auth/dto/forgot-password.dto.ts` *(new)*: `ForgotPasswordDto` with a single `email` field validated with `@IsEmail @IsNotEmpty`.
- `apps/api/src/auth/auth.service.ts`: Added `forgotPassword()` — looks up user by email; always returns `{ ok: true }` (prevents user enumeration); skips DB write when user is not found or inactive; otherwise generates a UUID reset token with 1-hour TTL, persists it via `prisma.user.update`, and calls `sendPasswordResetEmail()`. Added private `sendPasswordResetEmail()` — logs reset URL in dev (no `RESEND_API_KEY`); sends a Vietnamese-language reset email via Resend in production with HTML-escaped name. Added `RESET_TOKEN_TTL_HOURS = 1` constant.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/forgot-password` route using `@Body() ForgotPasswordDto`, returns 200.
- `apps/api/src/auth/auth.service.spec.ts`: Added `forgotPassword` describe block with 3 cases: known active user → token persisted with ~1h expiry; unknown email → `{ ok: true }` without DB write; inactive user → `{ ok: true }` without DB write.

All 20 auth service tests pass. Ran `npx prisma generate` to update the client.

---

## 2026-05-24 (35b) — Review fix: POST /auth/verify-email

**Issue found and fixed:**
- **Missing test for null `verificationTokenExpiry`** — the `!user.verificationTokenExpiry` branch in `verifyEmail()` (handles users created without an expiry, e.g. via direct DB insert) had no test. Added case "throws 400 when verificationTokenExpiry is null" to `auth.service.spec.ts`.

All 17 auth service tests pass.

---

## 2026-05-24 (35) — Phase 3: Auth module — POST /auth/verify-email

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `verifyEmail(token)` — looks up user by `verificationToken` (unique index); throws 400 if not found; returns `{ ok: true }` immediately if already verified (idempotent); throws 400 if `verificationTokenExpiry` is in the past; otherwise sets `emailVerified = true` and nulls out both token fields.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/verify-email` route using `@Body() VerifyEmailDto`.
- `apps/api/src/auth/dto/verify-email.dto.ts` *(new)*: `VerifyEmailDto` with a single `token` field (`@IsString @IsNotEmpty`).
- `apps/api/src/auth/auth.service.spec.ts`: Added `verifyEmail` describe block with 4 cases: valid token → user updated; already verified → returns ok without update; unknown token → 400; expired token → 400. Also added `update: jest.fn()` to `mockPrisma.user`.

All 16 auth service tests pass.

**Also:** Ran `npx prisma generate` to regenerate the Prisma client — `verificationToken` and `verificationTokenExpiry` fields were in `schema.prisma` but the generated client was stale.

---

## 2026-05-24 (34b) — Review fix: POST /auth/logout

**Issues found and fixed:**
1. **Missing unit test** — test plan targets 90% auth service coverage and explicitly lists `POST /api/v1/auth/logout` in the integration test suite. No test existed. Fixed: added `logout` describe block in `auth.service.spec.ts` that asserts `clearCookie` is called for both `access_token` and `refresh_token` with `httpOnly: true, path: '/'` options, and that the return value is `{ ok: true }`.
2. **`makeMockResponse` lacked `clearCookie` mock** — calling `logout` would throw `TypeError: res.clearCookie is not a function` in existing test infrastructure. Fixed: added `clearCookie: jest.fn()` to the mock response factory.

All 12 auth service tests pass.

---

## 2026-05-24 (34) — Phase 3: Auth module — POST /auth/logout

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `logout()` — calls `res.clearCookie` for both `access_token` and `refresh_token` with the same cookie options used when setting them (`httpOnly`, `sameSite: lax`, `secure` in prod, `path: /`), then returns `{ ok: true }`.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/logout` route; uses `@Res({ passthrough: true })` to write cookie-clearing headers while NestJS handles serialisation normally.

---

## 2026-05-24 (33) — Phase 3: Auth module — POST /auth/refresh

**Files changed:**
- `apps/api/src/auth/auth.service.ts`: Added `refresh()` — reads `refresh_token` HttpOnly cookie, verifies with `JWT_REFRESH_SECRET`, checks user still exists/active/verified, issues a rotated access token (15 min) + refresh token (7 days) as new HttpOnly cookies. Extracted `setTokenCookies()` helper shared with `login()`.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/refresh` route using `@Req()` + `@Res({ passthrough: true })`.
- `apps/api/src/auth/auth.service.spec.ts`: Added `refresh` describe block with 4 unit tests: valid token → new cookies issued; no cookie → 401; wrong secret → 401; user not found → 401. Uses `beforeAll`/`afterAll` to set JWT env secrets for the test scope.

---

## 2026-05-24 (32b) — Review fix: POST /auth/login

**Issues found and fixed:**
1. **Missing `emailVerified` check** — product spec requires "Unverified email accounts cannot access the app". Added guard in `login()` that throws 401 before issuing tokens if `emailVerified` is false.
2. **Missing unit tests for login** — test plan requires `Login with correct credentials`, `Login with wrong password`, and by extension unverified/missing user cases. Added a `login` describe block in `auth.service.spec.ts` with 4 cases covering all paths.
3. **IDE couldn't resolve jest globals in spec files** — `tsconfig.json` excluded `**/*.spec.ts`, so the language server never loaded `@types/jest`. Fixed by removing spec files from `tsconfig.json`'s exclude (build still uses `tsconfig.build.json` which keeps them excluded) and adding `"types": ["jest", "node"]`. Also added `tsconfig.spec.json` pointed at by the jest `transform` config.

All 7 tests pass.

---

## 2026-05-24 (32) — Phase 3: Auth module — POST /auth/login

**Files changed:**
- `apps/api/src/auth/dto/login.dto.ts` *(new)*: `LoginDto` with `email` + `password` fields validated via `class-validator`.
- `apps/api/src/auth/auth.service.ts`: Added `login()` — looks up user by email, bcrypt-compares password (constant-time; same error for wrong email and wrong password to prevent user enumeration), checks `isActive`, signs access token (15 min) and refresh token (7 days) with separate secrets, sets both as `HttpOnly; SameSite=Lax; Secure in prod` cookies, returns safe user fields.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/login` using `@Res({ passthrough: true })` to let NestJS still handle serialisation while the service writes cookies directly.
- `apps/api/src/auth/auth.module.ts`: Imported `JwtModule.register({})` (secrets passed per-call so no global secret needed).
- `apps/api/src/main.ts`: Registered `cookie-parser` middleware.
- `apps/api/package.json`: Added `@nestjs/jwt`, `cookie-parser`, `@types/cookie-parser`.

---

## 2026-05-24 (31b) — Review fix: POST /auth/register

**Issues found and fixed:**
1. **HTML injection in verification email** — `name` was interpolated raw into the HTML email body. A user with a name containing `<`, `>`, or `&` would break email rendering; a crafted name could inject arbitrary HTML. Fixed: added `escapeHtml()` helper in `auth.service.ts` that escapes `&`, `<`, `>`, `"`, `'`; used it when building the email `html` string.
2. **Missing unit tests** — test plan requires AuthService unit tests at 90% coverage with specific cases. Fixed: created `src/auth/auth.service.spec.ts` covering all three test plan cases: (a) valid registration → user created with hashed password and safe fields returned; (b) duplicate email → 409 ConflictException; (c) verification token stored with a 24h future expiry. All 3 tests pass.
3. **Missing `@nestjs/testing`** — dev dependency required by Jest test module; added to `apps/api/package.json`.

---

## 2026-05-24 (31) — Phase 3: Auth module — POST /auth/register

**Files created:**
- `apps/api/src/auth/auth.module.ts`: NestJS module wiring `AuthController` and `AuthService`.
- `apps/api/src/auth/auth.controller.ts`: `POST /api/v1/auth/register` — returns 201 with safe user fields (no password hash).
- `apps/api/src/auth/auth.service.ts`: `register()` — checks email uniqueness (409 on conflict), hashes password with bcrypt (12 rounds), generates a UUID verification token (24h TTL), writes the user to DB, then sends a verification email. If `RESEND_API_KEY` is set, sends via Resend; otherwise logs the verification URL.
- `apps/api/src/auth/dto/register.dto.ts`: `RegisterDto` — `name` (string), `email` (valid email), `password` (min 8 chars) validated with `class-validator`.
- `apps/api/prisma/migrations/20260524_add_verification_token_to_user/migration.sql`: adds `verificationToken` (unique, nullable) and `verificationTokenExpiry` (nullable DateTime) columns to `users` table.

**Files changed:**
- `apps/api/prisma/schema.prisma`: added `verificationToken String? @unique` and `verificationTokenExpiry DateTime?` fields to `User` model.
- `apps/api/src/app.module.ts`: imported `AuthModule`.
- `apps/api/package.json`: added `bcrypt`, `@types/bcrypt`, and `resend` dependencies.

---

## 2026-05-24 (30) — Phase 2: Shared components — Status badge component

**Files created:**
- `apps/web/components/ui/status-badge.tsx`: `StatusBadge` component. Accepts `status: AppStatus` (`'ACTIVE' | 'SETTLED' | 'ARCHIVED' | 'PENDING' | 'CONFIRMED' | 'INACTIVE'`) and optional `className`. Each status maps to a Vietnamese label, a Badge variant, and an optional Lucide icon: ACTIVE → "Đang diễn ra" (success); SETTLED → "Đã huề" (outline); ARCHIVED → "Đã lưu trữ" (secondary); PENDING → "Chờ xác nhận" (warning, Clock icon); CONFIRMED → "Đã xác nhận" (success, CheckCircle2 icon); INACTIVE → "Đã vô hiệu" (destructive).

**Files changed:**
- `apps/web/app/(app)/events/[id]/settlements/page.tsx`: removed inline `StatusBadge` function and unused `SettlementStatus` type; changed `Settlement.status` to `AppStatus`; replaced imports.
- `apps/web/app/(app)/dashboard/page.tsx`: removed `STATUS_LABELS` and `STATUS_VARIANTS` maps; replaced inline `<Badge variant={STATUS_VARIANTS[…]}>…</Badge>` with `<StatusBadge status={event.status} />`.
- `apps/web/app/(app)/admin/page.tsx`: removed `EVENT_STATUS_LABELS` and `EVENT_STATUS_VARIANTS` maps; replaced event status Badge with `<StatusBadge status={event.status} />`. User ACTIVE/INACTIVE kept as inline Badge (different label "Hoạt động" and `outline` variant vs event ACTIVE semantics).

---

## 2026-05-24 (29) — Phase 2: Shared components — Currency display component

**Files created:**
- `apps/web/components/ui/currency.tsx`: `CurrencyDisplay` component. Props: `amount` (integer VND value), `className` (optional). Formats the integer using `toLocaleString('vi-VN')` (produces dot-separated thousands, e.g. "150.000") and appends " ₫". Always renders with `tabular-nums` so columns of amounts stay aligned.

---

## 2026-05-24 (28b) — Review fix: Avatar component

**Issues found and fixed in `apps/web/components/ui/avatar.tsx`:**
1. **Runtime error on external `src` URLs** — used `next/image` which requires `remotePatterns` in `next.config.ts` for Cloudinary URLs; any external avatar URL would throw at runtime. Fixed: switched to a plain `<img>` tag with an `eslint-disable` comment explaining the intent. This avoids domain config requirements while keeping the photo path working for all URL origins.
2. **WCAG 2.1 AA — missing accessible label on initials** — spec §8 requires WCAG 2.1 AA for core flows; the initials `<div>` rendered as unlabelled presentational text. Fixed: added `role="img"` and `aria-label={name}` so screen readers announce the person's name instead of raw initials.

---

## 2026-05-24 (28) — Phase 2: Shared components — Avatar component

**Files created:**
- `apps/web/components/ui/avatar.tsx`: `Avatar` component. Props: `name` (required — used for initials and `alt`), `src` (optional image URL), `size` (`'sm'` 28 px / `'md'` 32 px / `'lg'` 36 px, default `'md'`), `className`. Initials logic: single-word names → first letter; multi-word names → first + last word initials (e.g. "Minh Anh" → "MA"). When `src` is provided, renders a Next.js `<Image>` inside the circle. Falls back to initials when `src` is absent.

**Files changed:**
- `apps/web/app/(app)/events/[id]/balances/page.tsx`: replaced inline `h-8 w-8` avatar div with `<Avatar name={member.name} size="md" />`.
- `apps/web/app/(app)/events/[id]/members/page.tsx`: replaced inline `h-9 w-9` avatar div with `<Avatar name={member.name} size="lg" />`.
- `apps/web/app/(app)/events/[id]/chat/page.tsx`: replaced inline `h-7 w-7` avatar div (with conditional `invisible` class) with `<Avatar name={msg.sender} size="sm" className={cn('mt-0.5', !showSender && 'invisible')} />`.

---

## 2026-05-24 (27) — Phase 2: Shared components — Empty state component

**Files created:**
- `apps/web/components/ui/empty-state.tsx`: reusable `EmptyState` component. Props: `icon` (Lucide `React.ElementType`), `title` (required string), `description` (optional string), `bordered` (boolean — adds `rounded-xl border border-dashed` wrapper, used on dashboard), `className` (escape hatch for padding/height overrides), `children` (action slot for CTA buttons).

**Files changed:**
- `apps/web/app/(app)/dashboard/page.tsx`: replaced inline dashed-border empty state with `<EmptyState icon={MapPin} bordered …>`.
- `apps/web/app/(app)/events/[id]/expenses/page.tsx`: replaced inline empty state with `<EmptyState icon={Receipt} …>`.
- `apps/web/app/(app)/events/[id]/settlements/page.tsx`: replaced inline empty state with `<EmptyState icon={Handshake} …>`.
- `apps/web/app/(app)/events/[id]/chat/page.tsx`: replaced inline empty state with `<EmptyState icon={MessageCircle} className="h-full py-0" />`.

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
