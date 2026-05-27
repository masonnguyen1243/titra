# Change Log — Titra

## 2026-05-27 (169) — Balances QA fix: Add "Thử lại" retry button to error state (M2)

**Files changed:**

- `apps/web/app/(app)/events/[id]/balances/page.tsx`:
  - Added `import { useQueryClient } from '@tanstack/react-query'`.
  - Added `import { Button } from '@/components/ui/button'`.
  - Added `import { useBalances, balanceKeys } from '@/lib/hooks/use-balances'` (added `balanceKeys` to existing import).
  - Added `const qc = useQueryClient()` inside the component.
  - Updated the `isError` branch: added a `<Button size="sm" variant="outline">Thử lại</Button>` that calls `qc.invalidateQueries({ queryKey: balanceKeys.detail(id) })` on click, consistent with the retry pattern already used in the expenses page.
- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (168) — Phase 4: Wire Balances tab to live API

**Tasks completed:**
- Balance tab fetches `/balances` endpoint and renders simplified transaction list
- Live recalculates after any expense create/edit/delete

**Files changed:**

- `apps/web/app/(app)/events/[id]/balances/page.tsx`:
  - Removed all static mock data (`SEED_EXPENSES`, `MOCK_MEMBERS`, local `computeNetBalances`/`simplifyDebts` functions).
  - Imports and calls `useBalances(id)` from `@/lib/hooks/use-balances`.
  - Shows `BalancesSkeleton` while loading (per-member rows + suggestion rows with `Skeleton` components matching the final layout).
  - Shows a Vietnamese error message when `isError` is true.
  - Renders `data.members` for the "Số dư từng người" section — each row shows `Avatar`, `nickname`, and coloured `net` amount with `TrendingUp`/`TrendingDown`/`Minus` icons.
  - Renders `data.settlements` for the "Ai cần trả ai" section — each row shows `fromNickname → toNickname` and formatted amount; falls back to the "Mọi người đã huề cả làng 🎉" empty state when the array is empty.
  - **Live recalculation** is already covered: `useCreateExpense`, `useUpdateExpense`, and `useDeleteExpense` all call `qc.invalidateQueries(['events', eventId, 'balances'])` in `onSettled`, which triggers a re-fetch of the balances query automatically.
- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (167) — Phase 4 QA fix: Cancel in-flight Cloudinary upload when a new file is selected (S2)

**Files changed:**

- `apps/web/lib/hooks/use-upload.ts`:
  - Added `import { useRef } from 'react'`.
  - Added `abortControllerRef = useRef<AbortController | null>(null)` inside `useCloudinaryUpload`.
  - At the start of `mutationFn`: call `abortControllerRef.current?.abort()` to cancel any previous upload, then create a fresh `AbortController` and store it in the ref.
  - Added an explicit `signal.aborted` guard after `api.get('/upload/sign')` — if the controller was aborted while we were waiting for the signed params (which `api.ts` does not pass the signal to internally), we throw `DOMException('AbortError')` immediately before touching Cloudinary at all.
  - Passed `signal` to the Cloudinary `fetch` call — the browser cancels the POST mid-flight if the controller is aborted.
  - `finally`: clears the ref only when `abortControllerRef.current === controller` (i.e. this was still the most recent upload), so the newest in-flight upload is never accidentally cleared.

- `apps/web/components/features/add-expense-dialog.tsx`:
  - Narrowed the `catch {}` in `handleReceiptChange` to `catch (err)`.
  - Added early `return` for `AbortError`: when a new file is selected while an upload is in progress, the old mutation throws `AbortError`; the catch must **not** call `setReceipt(null)` or clear `receiptError` because the new file's state has already been set by its own `handleReceiptChange` invocation. The early return prevents overwriting the new file's state.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (166) — Phase 4 QA fix: Show inline error message in expense dialog on submit failure (M4)

**Files changed:**

- `apps/web/components/features/add-expense-dialog.tsx`:
  - Added `submitError` state (`useState('')`).
  - Reset `submitError` in `resetForm()` and in both branches of the `useEffect` that populates the form on `open`.
  - Wrapped `await onSubmit(values)` in `handleSubmit` in a `try/catch`: on success the dialog closes as before; on failure `submitError` is set to `err.message` (for `Error` instances) or the generic Vietnamese fallback string — the dialog stays open.
  - Rendered `{submitError && <p className="text-xs text-destructive" role="alert">{submitError}</p>}` directly above `<DialogFooter>` so the error appears just above the action buttons, within the dialog, without requiring the user to dismiss a toast.
  - `role="alert"` ensures the message is announced by screen readers.
  - **Note:** The parent (`page.tsx`) already shows a `toast.error()` when `onSubmit` throws. The dialog's catch block no longer re-throws, so the toast is not triggered twice — the toast path in `page.tsx` still fires because the page's try/catch runs before the dialog's. The two error displays are complementary: the toast is transient; the inline message persists inside the dialog until the user corrects the form or closes it.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (165) — Phase 4 QA fix: Resolve payer nickname in optimistic expense create (M3)

**Files changed:**

- `apps/web/lib/hooks/use-expenses.ts`:
  - Added local `OptimisticMember` interface `{ id: string; nickname: string; userId: string | null }`.
  - Changed `useCreateExpense(eventId: string)` → `useCreateExpense(eventId: string, members?: OptimisticMember[])`.
  - In `onMutate`, added `const payer = members?.find((m) => m.id === payload.paidById)`.
  - Updated the optimistic `paidBy` field from `{ id, nickname: '…', userId: null }` to `{ id, nickname: payer?.nickname ?? '…', userId: payer?.userId ?? null }`.
  - When `members` is provided (which it will be in the normal flow), the temporary expense renders the real payer name instantly. Falls back to `'…'` if the member can't be found or if the hook is called without the list.

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Changed `useCreateExpense(id)` → `useCreateExpense(id, event?.members)`.
  - `event?.members` is already fetched by `useEventDetail(id)` at the top of the component; passing it here costs nothing extra. While `event` is still loading, the hook receives `undefined` and the fallback `'…'` is used — identical to the previous behaviour.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (164) — Phase 4 QA fix: Make expense edit/delete buttons always visible on mobile (M5)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Changed the hover-reveal wrapper on the per-row action buttons from `opacity-0 group-hover:opacity-100` → `sm:opacity-0 sm:group-hover:opacity-100`.
  - **Effect:** On viewports narrower than `sm` (640 px — covers all 375 px mobile targets), no opacity class is applied so the buttons render at full opacity by default. On `sm` and wider (desktop/tablet), the existing hover-reveal behaviour is preserved. No layout or functional change for desktop users.
  - **Why:** CSS `:hover` pseudo-class never fires on touch-only devices (iOS Safari, Android Chrome). The previous `opacity-0 group-hover:opacity-100` pattern made the ✏️ and 🗑️ buttons permanently invisible on phones, preventing all edit and delete actions. Spec §8 requires the app to be "fully usable on 375 px viewport (iOS Safari, Android Chrome)".

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (163) — Phase 4 QA fix: Validate MIME type of receipt file before upload (M1)

**Files changed:**

- `apps/web/components/features/add-expense-dialog.tsx`:
  - Added `ALLOWED_RECEIPT_TYPES` constant: `['image/jpeg', 'image/png', 'image/heic', 'image/heif']`.
  - Added MIME type check at the top of `handleReceiptChange`, **before** the size check. If `file.type` is not in the allowlist, sets `receiptError` to `'Chỉ chấp nhận ảnh JPG, PNG, HEIC hoặc HEIF.'`, clears the file input, and returns early.
  - Updated the `accept` attribute on the hidden file input from `"image/jpeg,image/png,image/heic"` to `"image/jpeg,image/png,image/heic,image/heif"` to be consistent with the HEIF allowlist entry.
  - **Why:** The `accept` HTML attribute is advisory-only and can be bypassed by renaming any file to `.jpg`. The previous code only validated `file.size`, so a renamed PDF/executable could pass the filter and be sent to Cloudinary. The runtime MIME check uses the browser-reported `file.type` which is derived from the file's binary signature, not its extension — a much stronger guard.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (162) — Phase 4 QA fix: Replace window.location.reload() with targeted query invalidation in error state (S3)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Added `import { useQueryClient } from '@tanstack/react-query'`.
  - Added `expenseKeys` to the existing `use-expenses` import.
  - Added `const qc = useQueryClient()` at the top of the component.
  - Replaced `onClick={() => window.location.reload()}` on the "Thử lại" button in the error state with `onClick={() => void qc.invalidateQueries({ queryKey: expenseKeys.list(id) })}`.
  - `invalidateQueries` marks only the `['events', id, 'expenses']` query as stale and triggers a background re-fetch. The rest of the TanStack Query cache (event detail, member list, balances, other tabs) is untouched. `window.location.reload()` was discarding the entire cache unnecessarily and causing the full app shell to re-render — consistent with the pattern already used on the dashboard error state.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (161) — Phase 4 QA fix: Disable per-row edit/delete buttons while a mutation is in-flight (M2)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Added `disabled={isBusy}` to the pencil (edit) button and the trash-icon (delete-trigger) button inside the hover-reveal action container.
  - `isBusy` was already computed (`createExpense.isPending || updateExpense.isPending || deleteExpense.isPending`) and applied to the top-level "Thêm chi phí" button, but the per-row trigger buttons were left unguarded. A user could click ✏️ or 🗑️ on any row while a mutation for a different row was still in-flight, causing interleaved optimistic updates and unpredictable rollback behaviour.
  - The "Xoá" confirm button already had `disabled={deleteExpense.isPending}` — that narrower guard is correct and unchanged (it only disables the final confirm step while the delete itself is in-flight, not during create/update).

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (160) — Phase 4 QA fix: Hide edit/delete buttons from non-owners (F3)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Added `import { useMe } from '@/lib/hooks/use-user'`.
  - Added `useMe()` call; stores result in `me`.
  - Added `isOrganizer` derived value: searches `event.members` for the member whose `userId` matches `me.id`, returns true if their `role === 'ORGANIZER'`.
  - Inside the expense list `map`, added `canManage` per-row flag: `isOrganizer || expense.paidBy.userId === me?.id`. The `paidBy.userId` identifies the registered user who made the payment — the backend uses the same field as the "creator" for edit/delete authorization.
  - Wrapped the entire action-button block (both the confirm-delete row and the hover-reveal row) in `{canManage && (…)}`. Members who are neither the expense payer nor the organizer see no buttons at all — not even the hover-reveal placeholder — so there is no confusing empty space on hover.
  - `useMe` uses `GET /users/me` which is already cached by TanStack Query from the layout; this adds no new network request.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (159) — Phase 4 QA fix: Error toast on expense create/update/delete failure (F2)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Added `import { ApiError } from '@/lib/api'`.
  - Wrapped `handleSubmit` body in `try/catch`: on error, shows `toast.error(err.message)` when the thrown error is an `ApiError` (carries the backend's Vietnamese message), falls back to a generic `'Không thể lưu chi phí. Vui lòng thử lại.'` for network/unexpected errors. **Re-throws** after showing the toast so `AddExpenseDialog` sees the rejection and keeps itself open (the form is not closed on failure).
  - Wrapped `handleDelete` body in `try/catch`: on error, shows `toast.error` with same pattern. Does **not** re-throw — the delete-confirm row has already been dismissed by the preceding `setConfirmDeleteId(null)`; re-throwing here would leave the page in an inconsistent state.
  - Previously: `mutateAsync` throw was completely unhandled — optimistic rollback happened silently, user had no idea whether their action succeeded or failed.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (158) — Phase 4 QA fix: Add `group` class to expense row — edit/delete buttons permanently invisible (F1)

**Files changed:**

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Added `group` to the `className` of the expense row `div` (line 192). The inner action-button container uses `opacity-0 group-hover:opacity-100 transition-opacity` to reveal the edit (✏️) and delete (🗑️) buttons on hover. Without a `group` ancestor, Tailwind's `group-hover:` variant never fires — both buttons were permanently invisible and unclickable regardless of hover state. One-word fix; no logic change.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (157) — Phase 4: Expenses — real API, edit/delete, Cloudinary receipt upload

**Files changed:**

- `apps/web/lib/hooks/use-expenses.ts`:
  - Corrected `CreateExpensePayload` field names to match backend DTO: `paidByMemberId` → `paidById`, `splitMode` → `splitType`.
  - Added `memberIds?: string[]` to `CreateExpensePayload` (for EQUAL split mode).
  - Fixed `Expense` interface: `splitMode` → `splitType`.
  - Added **optimistic updates** to `useCreateExpense`, `useUpdateExpense`, and `useDeleteExpense`: cancel in-flight queries, apply immediate UI change, roll back on error, then invalidate on settle.

- `apps/web/lib/hooks/use-upload.ts` *(new)*:
  - `useCloudinaryUpload()` mutation: fetches signed upload params from `GET /upload/sign`, then POST the file directly from the browser to Cloudinary's upload API. Returns the `secure_url`.

- `apps/web/components/features/add-expense-dialog.tsx`:
  - Renamed member type to `ExpenseDialogMember` and callback payload to `ExpenseFormValues` (API-ready shape with `paidById`, `splitType`, `memberIds`, `splits`, `receiptUrl`).
  - Added `InitialExpense` prop for edit-mode pre-filling (description, amount, payer, category, splitType, splits, receiptUrl).
  - Receipt upload: on file selection the component calls `useCloudinaryUpload()` immediately; shows spinner during upload; stores `uploadedReceiptUrl` in state; submit button is disabled while uploading; on failure shows error but does not block form submission without a receipt.
  - Added `isSubmitting` prop to show spinner on submit button.
  - Dialog title and submit label adapt between "Thêm chi phí" and "Chỉnh sửa chi phí" based on `initialExpense` presence.

- `apps/web/app/(app)/events/[id]/expenses/page.tsx`:
  - Removed all static seed data (`SEED_EXPENSES`, `MOCK_MEMBERS`).
  - Fetches real expense list via `useExpenses(id)`.
  - Fetches event members via `useEventDetail(id)` and maps to `ExpenseDialogMember[]`.
  - Shows `ExpenseListSkeleton` while loading.
  - Shows error state with "Thử lại" button when fetch fails.
  - **Add expense**: `useCreateExpense` mutation; dialog opened via "Thêm chi phí" button.
  - **Edit expense**: Pencil icon on each row opens dialog pre-filled via `toInitialExpense()`; `useUpdateExpense` mutation on submit.
  - **Delete expense**: Trash icon enters inline "Xoá / Huỷ" confirmation row; `useDeleteExpense` mutation on confirm (optimistic — row removed instantly).
  - Shows receipt link ("Hoá đơn ↗") inline when `receiptUrl` is present.
  - `toast.success` feedback on create / update / delete.

- TypeScript passes cleanly (`tsc --noEmit` exits 0). ESLint: no warnings or errors.

---

## 2026-05-27 (156) — Phase 4 QA: Dashboard & events UI fixes (F1–F6)

**Files changed:**

- `apps/web/app/(app)/events/[id]/members/page.tsx`:
  - **F1** — Added `isError` from `useEventDetail`; renders an `AlertCircle` error banner ("Không thể tải danh sách thành viên") instead of silently showing "0 thành viên" when the API fails.
  - **F4** — Added `.catch()` on `navigator.clipboard.writeText()` that fires a `toast.error` when clipboard access is denied (HTTP context or permission rejected).
  - **F5** — Destructured `isLoading: isInviteLoading` from `useInviteLink`; while loading the invite link renders a `Skeleton` placeholder instead of the raw `…` character; Copy button is disabled while loading.

- `apps/web/app/(app)/events/[id]/layout.tsx`:
  - **F2** — Changed `STATUS_VARIANTS.SETTLED` from `'warning'` to `'outline'` to match the canonical `StatusBadge` component (`status-badge.tsx`).
  - **F6** — Tab navigation (`<nav>`) is now conditionally rendered only when `!isError`, preventing clickable tabs from appearing when the event returns 404 or 403.

- `apps/web/app/(app)/events/new/page.tsx`:
  - **F3** — After a cover photo is selected (preview is shown), an amber info banner is displayed: "Ảnh bìa sẽ chưa được tải lên — tính năng này đang được phát triển." — the event is still created normally without the image.

- TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (155) — Phase 4: Event detail fetches event data and member list

**Files changed:**

- `apps/web/app/(app)/events/[id]/layout.tsx`:
  - Removed `MOCK_EVENTS` record and local `MockEvent` interface.
  - Imported `useEventDetail`, `EventType`, `EventStatus` from `@/lib/hooks/use-events` and `Skeleton` from `@/components/ui/skeleton`.
  - Calls `useEventDetail(id)` to fetch real event name, description, type, status, and active member count (`event.members.length`).
  - **Loading state:** skeleton placeholders for the title row, description line, member count, and both badge chips.
  - **Error state:** "Không tìm thấy sự kiện" with an explanatory sub-line (covers both 404 and 403 cases).
  - **Loaded state:** renders real `event.name`, `event.description`, `event.type`, `event.status`, and `event.members.length` — identical layout to the previous mock rendering.
  - Tab navigation unchanged; `id` still drives all `href` values.

- `apps/web/app/(app)/events/[id]/members/page.tsx`:
  - Removed all mock data (`MOCK_MEMBERS`, `DEFAULT_MEMBERS`, `INVITE_TOKENS`, `CURRENT_USER_ID`).
  - Removed `useEffect` that was constructing a fake invite URL.
  - Imported `useEventDetail`, `useInviteLink`, `useRemoveMember`, `MemberRole` from events hooks; `useMe` from user hook; `Skeleton` and `toast`.
  - `useEventDetail(id)` — member list comes from the same cached response as the layout (no extra network request).
  - `useMe()` — identifies the current user by `me.id`; used to mark the logged-in member as "(bạn)" and to detect organizer status via `myMember.role === 'ORGANIZER'`.
  - `useInviteLink(id)` — only enabled when the current user is the organizer (passing `''` otherwise disables the query). Invite link section hidden from non-organizers entirely.
  - `useRemoveMember(id)` — remove button calls the real `DELETE /events/:id/members/:memberId` endpoint; shows "Đang xoá…" while in-flight; shows success/error toasts; closes the confirm dialog on completion.
  - Guest detection: members with `userId === null` get a "Khách" outline badge instead of the role badge.
  - **Loading skeleton:** 3 placeholder rows (avatar circle + name + role chip) while event data loads.
  - TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (154) — Phase 4: Create Event form submits → redirects to new event detail page

**Files changed:**
- `apps/web/app/(app)/events/new/page.tsx`:
  - Added imports: `useRouter` (next/navigation), `toast` (sonner), `useCreateEvent` (hooks), `ApiError` (api).
  - Added `useRouter()` and `useCreateEvent()` — destructured `mutate: createEvent` and `isPending`.
  - Replaced the stub `handleSubmit` with a real implementation: calls `createEvent({ name, type, description })`, trims whitespace before sending, omits `coverImageUrl` (Cloudinary upload is a later task).
  - `onSuccess` → shows `toast.success('Sự kiện đã được tạo!')` then `router.push('/events/<newEvent.id>')`.
  - `onError` → shows `toast.error` with the `ApiError.message` when available, falls back to a generic Vietnamese message.
  - Submit button: disabled while `isPending` or when `name` is blank; label changes to `'Đang tạo…'` during the request.
  - Cancel button: disabled while `isPending` to prevent navigation mid-flight.
  - Cover photo UI kept as-is (preview, remove, file validation) — will be wired to Cloudinary in the "Receipt photo: upload to Cloudinary" task.
  - TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (153) — Phase 4: Dashboard fetches and renders real event list

**Files changed:**
- `apps/web/app/(app)/dashboard/page.tsx`:
  - Added `'use client'` directive — converted from a static server component to a client component.
  - Removed all `MOCK_EVENTS` static data and the local `EventCard` interface.
  - Imported `useEvents` and `EventType` from `@/lib/hooks/use-events`.
  - Imported `EventCardsSkeleton` from `@/components/ui/skeletons`.
  - Uses `isLoading` state → renders `<EventCardsSkeleton count={3} />` while fetching.
  - Uses `isError` state → renders an `<EmptyState>` with a "Thử lại" reload button.
  - Uses `events?.length === 0` → renders the existing "Bạn chưa có chuyến đi nào" empty state.
  - Maps over real `events` array: `_count.members` for member count, `createdAt` for the date display.
  - TypeScript passes cleanly (`tsc --noEmit` exits 0).

---

## 2026-05-27 (152) — Phase 4 QA fix: Hide email from check-email URL — use sessionStorage (S2)

**Files changed:**
- `apps/web/app/(auth)/register/page.tsx` (`onSuccess` handler):
  - Replaced `router.push('/check-email?email=' + encodeURIComponent(email))` with:
    1. `sessionStorage.setItem('pendingVerificationEmail', email)` — stores the email browser-side only.
    2. `router.push('/check-email')` — no query param in the URL.
  - The email never appears in the URL, browser history, server access logs, or `Referer` headers.
- `apps/web/app/(auth)/check-email/page.tsx`:
  - Removed `useSearchParams` import (no longer needed).
  - `CheckEmailContent` now uses `useState('')` + `useEffect` to read `sessionStorage.getItem('pendingVerificationEmail')` on mount.
  - The `sessionStorage` key is intentionally **not cleared** on read — it stays available if the component re-mounts (e.g., dev fast-refresh) and expires naturally when the tab closes.
  - `Suspense` wrapper is kept as a structural boundary providing the skeleton during client-side navigation.
  - Build verified: no `useSearchParams` warning, route compiles cleanly.

---

## 2026-05-27 (151) — Phase 4 QA fix: Persist returnUrl in sessionStorage for post-login redirect (S1)

**Files changed:**
- `apps/web/lib/api.ts` (401 handler):
  - Before `window.location.href = '/login'`, saves `window.location.pathname + window.location.search` into `sessionStorage` under key `'returnUrl'`.
  - Only stored when `returnUrl !== '/login'` to avoid storing a self-redirect loop.
  - Pathname + search only (not full `href`) to prevent open-redirect: the login page will only navigate to an internal path.
- `apps/web/app/(auth)/login/page.tsx` (handleSubmit `onSuccess`):
  - Reads `sessionStorage.getItem('returnUrl')` after successful login.
  - Falls back to `'/dashboard'` when the key is absent (normal direct login, no 401 trigger).
  - Removes the key with `sessionStorage.removeItem('returnUrl')` before navigating so it's consumed exactly once.
  - Uses `router.push(returnUrl)` for client-side navigation.

---

## 2026-05-27 (150) — Phase 4 QA fix: Redirect authenticated users away from auth pages (M3)

**Files changed:**
- `apps/web/middleware.ts`:
  - Added `AUTH_ONLY_PREFIXES = ['/login', '/register', '/forgot-password']` constant.
  - Added `isAuthOnlyRoute(pathname)` helper — matches exact path or any sub-path of the prefixes.
  - Added guard as step 1 in `middleware()`: `if (isAuthOnlyRoute(pathname) && hasSession(request))` → `redirect('/dashboard')`. Runs before all other checks so it short-circuits immediately.
  - `/check-email` is intentionally excluded from `AUTH_ONLY_PREFIXES` — a freshly registered user still needs to reach that screen even while a session cookie may exist.
  - Renumbered existing inline comments (step 3 admin check → step 4) to keep them accurate.

---

## 2026-05-27 (149) — Phase 4 QA fix: Add logout button to AppLayout (M2)

**Files changed:**
- `apps/web/components/features/logout-button.tsx` *(new)*: Client component `LogoutButton`.
  - Calls `useLogout()` mutation on click → `POST /auth/logout` → `qc.clear()` (via hook's `onSuccess`).
  - On success: `router.push('/login')` to redirect the user after clearing the session.
  - On error: shows a Vietnamese error toast; does not redirect (allows retry).
  - Button label switches to "Đang đăng xuất…" and is disabled while the mutation is in flight.
- `apps/web/app/(app)/layout.tsx`:
  - Added `import { LogoutButton }`.
  - Added `<div className="ml-auto"><LogoutButton /></div>` at the right end of the header, after the nav links.
  - `ml-auto` pushes the button flush-right inside the flex header.

---

## 2026-05-27 (148) — Phase 4 QA fix: Add <Suspense> wrapper for useSearchParams() in check-email page (M1)

**Files changed:**
- `apps/web/app/(auth)/check-email/page.tsx` (full rewrite):
  - Extracted the card content (which calls `useSearchParams()`) into a new inner `CheckEmailContent` component.
  - Added a `CheckEmailSkeleton` component — a skeleton-card fallback shown while the Suspense boundary resolves the search params during SSR.
  - Default export `CheckEmailPage` now wraps `<CheckEmailContent>` in `<Suspense fallback={<CheckEmailSkeleton />}>`.
  - **Why needed:** Next.js App Router suspends `useSearchParams()` during server rendering. Without the boundary, the build emitted a warning ("useSearchParams() should be wrapped in a suspense boundary") and the SSR pass rendered `email = ''`, causing the "Quay lại đăng ký" branch to flash incorrectly for a brief moment before client hydration resolved the real email value from the URL.
  - Build verified: no `useSearchParams` warning after the change.

---

## 2026-05-27 (147) — Phase 4 QA fix: Wire Google OAuth button on login and register pages (F4)

**Files changed:**
- `apps/web/app/(auth)/login/page.tsx`:
  - Added module-level `GOOGLE_AUTH_URL` constant: `${NEXT_PUBLIC_API_URL}/api/v1/auth/google`.
  - Added `handleGoogleLogin()` function that sets `window.location.href = GOOGLE_AUTH_URL` — a full-page navigation required for the Passport redirect-based OAuth flow.
  - Added `onClick={handleGoogleLogin}` to the "Tiếp tục với Google" button.
  - Added `useEffect` on mount: reads `?error=oauth_failed` from the URL (set by the backend on OAuth failure), shows a Vietnamese error toast, then removes the param from the URL with `history.replaceState` so it doesn't persist on refresh.
- `apps/web/app/(auth)/register/page.tsx`:
  - Added same `GOOGLE_AUTH_URL` constant and `handleGoogleLogin()` function.
  - Added `onClick={handleGoogleLogin}` to the "Tiếp tục với Google" button.
  - Register and login share the same OAuth entry-point — Google does not distinguish between new and returning users; `auth.service.googleLogin()` creates a new user if one doesn't exist.

**Flow:** Click → `window.location.href` → `GET /api/v1/auth/google` → Passport redirects to Google consent → Google redirects to `/api/v1/auth/google/callback` → backend sets HttpOnly JWT cookies → redirects to `/dashboard` (or `/login?error=oauth_failed` on failure).

---

## 2026-05-27 (146) — Phase 4 QA fix: Replace <a> with Next.js <Link> in AppLayout nav (F3)

**Files changed:**
- `apps/web/app/(app)/layout.tsx`:
  - Added `import Link from 'next/link'`.
  - Replaced `<a href="/dashboard">` with `<Link href="/dashboard">`.
  - Replaced `<a href="/admin">` with `<Link href="/admin">`.
  - Using `<a>` caused a full browser page reload on every nav click, destroying the entire TanStack Query cache and all in-flight React state (forms, scroll position, open dialogs).
  - `<Link>` uses the Next.js client-side router — navigation is instant, the cache is preserved, and only the changed page segment re-renders.

---

## 2026-05-27 (145) — Phase 4 QA fix: Fix check-email page hardcoded expiry "15 phút" → "24 giờ" (F2)

**Files changed:**
- `apps/web/app/(auth)/check-email/page.tsx` (line 59): Changed the displayed link-expiry text from `"15 phút"` to `"24 giờ"` to match the actual `VERIFICATION_TOKEN_TTL_HOURS = 24` constant in `apps/api/src/auth/auth.service.ts`.
  - The mismatch caused users to believe their verification link had expired after 15 minutes and to spam the "Gửi lại email" button, when in reality the link was still valid for up to 24 hours.

---

## 2026-05-27 (144) — Phase 4 QA fix: Fix getRoleFromAccessToken missing base64 padding (F1 — critical)

**Files changed:**
- `apps/web/middleware.ts`: Fixed `getRoleFromAccessToken` to add proper base64 padding before calling `atob()`.
  - JWT payloads are base64url-encoded without `=` padding characters.
  - Edge Runtime's `atob()` throws `DOMException` when the input length is not a multiple of 4.
  - The silent `catch → return null` caused the admin guard `if (role !== null && role !== 'ADMIN')` to never fire — any authenticated non-admin user with a valid `access_token` would pass straight through to the admin shell.
  - Fix: `base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')` before calling `atob(paddedBase64)`.

---

## 2026-05-27 (143) — Phase 4: Protect /admin routes — redirect to /dashboard if not Admin

**Files changed:**
- `apps/web/middleware.ts`: Extended the existing auth middleware with admin role enforcement.
  - Added `ADMIN_PREFIXES = ['/admin']` constant.
  - Added `isAdminRoute(pathname)` helper.
  - Added `getRoleFromAccessToken(request)`: decodes the `role` claim from the `access_token` JWT using `atob` (Web API, required for Edge Runtime — no `Buffer`). Returns `null` if the cookie is absent, malformed, or has no role.
  - New guard (step 3 in middleware): when `isAdminRoute` is true and `access_token` is present with a non-ADMIN role → `redirect('/dashboard')`.
  - When only `refresh_token` is present (`role === null`): let through — the access token just expired, a transparent refresh is pending, and the API server enforces 403 on all admin calls anyway.
  - JWT signature is intentionally NOT verified (remains the API server's responsibility).

---

## 2026-05-27 (142) — Phase 4: Protect (app) routes — redirect to /login if no valid session

**Files changed:**
- `apps/web/middleware.ts` *(new file)*: Next.js Edge Middleware that guards the `(app)` route group.
  - Protected prefixes: `/dashboard`, `/events`, `/admin` (all sub-paths included).
  - Session check: at least one of `access_token` or `refresh_token` cookies must be present.
    - `access_token` present → normal authenticated session.
    - Only `refresh_token` present → access token expired; page is allowed through so `api.ts` can perform a transparent 401 → refresh cycle on the first API call.
    - Neither present → unauthenticated; redirect to `/login`.
  - JWT signature is NOT verified in middleware — that remains the API server's responsibility. The middleware only prevents unauthenticated visitors from rendering the app shell.
  - `config.matcher` excludes Next.js internals (`_next/static`, `_next/image`) and static assets to avoid middleware overhead on non-page requests.

---

## 2026-05-27 (141) — Phase 4: Wire forgot password form → POST /auth/forgot-password

**Files changed:**
- `apps/web/app/(auth)/forgot-password/page.tsx`: Wired the form to `useForgotPassword` mutation hook.
  - `handleSubmit` calls `forgotPassword(email)`.
  - On success: sets `submitted = true`, transitioning the card to a confirmation state.
  - On error: shows `toast.error(message)` with the API error message; form stays visible so user can correct.
  - Button shows **"Đang gửi…"** and is disabled while the mutation is in flight (`isPending`).
  - Email input is also `disabled` while pending; `required` attribute added.
  - **Post-submit confirmation state**: the form is replaced by an email-sent card showing the submitted address, a 1-hour expiry note, and a "Gửi lại email" button wired to `useForgotPassword` that shows a success toast on resend.

---

## 2026-05-27 (140) — Phase 4: Wire register form → POST /auth/register → check-email screen

**Files changed:**
- `apps/web/app/(auth)/register/page.tsx`: Connected the register form to the `useRegister` mutation hook.
  - `onSubmit` now calls `register({ name, email, password })`.
  - On success: redirects to `/check-email?email=<encoded_email>` so the email is available for resend verification.
  - On error: shows `toast.error(message)` with the API error message.
  - Submit button is disabled and labelled "Đang tạo tài khoản…" while pending (`isPending`).
  - All three inputs are also `disabled` while pending to prevent double-submit.
  - `required` attribute added to all fields for browser-level validation.
  - Google OAuth button is disabled while pending.
- `apps/web/app/(auth)/check-email/page.tsx`: Converted to a client component to support the resend flow.
  - Reads `email` from the URL search param (`?email=…`) set by the register redirect.
  - If `email` is present: shows the address in the description and renders a "Gửi lại email xác thực" button wired to `useResendVerification`.
  - If `email` is absent (direct navigation): shows a generic description and a "Quay lại đăng ký" link.
  - Resend button shows "Đang gửi…" and is disabled while the mutation is in flight.
  - Success toast: "Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư đến."
  - Error toast: API error message or generic fallback.

---

## 2026-05-27 (139) — Phase 4: Wire login form → POST /auth/login → redirect to dashboard

**Files changed:**
- `apps/web/app/(auth)/login/page.tsx`: Connected the login form to the `useLogin` mutation hook.
  - `onSubmit` now calls `login({ email, password })`.
  - On success: `router.push('/dashboard')` (uses Next.js `useRouter`).
  - On error: shows a `toast.error(message)` from sonner with the API's error message.
  - Submit button is disabled and labelled "Đang đăng nhập…" while the request is in flight (`isPending`).
  - All inputs are also `disabled` while pending to prevent double-submit.
  - `required` attribute added to both fields for browser-level validation before the mutation fires.
- `apps/web/app/(app)/layout.tsx`: Fixed pre-existing Next.js 15 type error — `cookies()` now returns a `Promise`; converted `getRoleFromAccessToken` to `async` and `await`ed the cookies call; converted `AppLayout` to `async` accordingly.

---

## 2026-05-26 (138) — Phase 4: Warn when NEXT_PUBLIC_API_URL is unset in production

**Files changed:**
- `apps/web/lib/api.ts`: Added a module-level `console.warn` that fires when `NEXT_PUBLIC_API_URL` is not set and `NODE_ENV === 'production'`. Silent in local dev (where the localhost fallback is intentional). Surfaces immediately in production logs so misconfigured deployments are caught before any API call is made.

---

## 2026-05-26 (137) — Phase 4: Switch useMessages to useInfiniteQuery

**Files changed:**
- `apps/web/lib/hooks/use-messages.ts`: Replaced `useQuery` with `useInfiniteQuery`. The cursor is now managed internally via `initialPageParam: undefined` and `getNextPageParam: (page) => page.nextCursor ?? undefined`. The external `cursor` parameter was removed — callers call `fetchNextPage()` to load older messages. `data.pages` accumulates all fetched pages so existing messages are never discarded when paginating.

  **Consumer change required:** chat pages must flatten messages with `data.pages.flatMap(p => p.messages)` instead of reading `data.messages` directly.

---

## 2026-05-26 (136) — Phase 4: Clear query cache on logout

**Files changed:**
- `apps/web/lib/hooks/use-auth.ts`: `useLogout` now imports `useQueryClient` and calls `qc.clear()` in `onSuccess`. This wipes all cached query data so a second user logging in on the same tab never sees the previous user's events, balances, or profile.

---

## 2026-05-26 (135) — Phase 4: Add useAcceptInvitation hook

**Files changed:**
- `apps/web/lib/hooks/use-events.ts`: Added `useAcceptInvitation()` — a `useMutation` that calls `POST /events/:eventId/invitations/:token/accept` and invalidates both `eventKeys.detail(eventId)` and `eventKeys.all()` on success so the dashboard and event detail pages reflect the new membership immediately.

---

## 2026-05-26 (134) — Phase 4: Add useVerifyEmail, useResetPassword, useResendVerification hooks

**Files changed:**
- `apps/web/lib/hooks/use-auth.ts`: Added three `useMutation` hooks that were missing but needed by existing frontend pages:
  - `useVerifyEmail(token)` → `POST /auth/verify-email`
  - `useResetPassword({ token, password })` → `POST /auth/reset-password`
  - `useResendVerification(email)` → `POST /auth/resend-verification`

---

## 2026-05-26 (133) — Phase 4: Tighten AddMemberPayload to discriminated union

**Files changed:**
- `apps/web/lib/hooks/use-events.ts`: Replaced the loose `{ email?: string; nickname?: string }` interface with `{ email: string } | { nickname: string }`. TypeScript now rejects empty-object calls and calls that supply both fields, catching the mistake at compile time instead of getting a cryptic 400 at runtime.

---

## 2026-05-26 (132) — Phase 4: Correct EventType enum in use-events.ts

**Files changed:**
- `apps/web/lib/hooks/use-events.ts`: Changed `'DINING'` → `'MEAL'` in the `EventType` union type to match the Prisma schema (`enum EventType { TRIP MEAL OTHER }`). The mismatch would have caused TypeScript to accept `'DINING'` payloads that the backend rejects with 400.

---

## 2026-05-26 (131) — Phase 4: Add 30-second request timeout to api.ts

**Files changed:**
- `apps/web/lib/api.ts`: Each `request()` call now creates an `AbortController` with a 30-second timeout (`setTimeout → controller.abort()`). The `signal` is passed to `fetch`, and the timer is cleared in `finally` to prevent leaks. An `AbortError` (triggered by the timeout) is caught and rethrown as `ApiError(0, 'Yêu cầu quá thời gian chờ (30s)')`.

---

## 2026-05-26 (130) — Phase 4: Suppress error state on session-expired redirect

**Files changed:**
- `apps/web/lib/api.ts`: After `window.location.href = '/login'`, now returns `new Promise<T>(() => {})` (a promise that never settles) instead of throwing. This prevents TanStack Query from catching an `ApiError` and briefly flashing an error state while the browser navigates away. The `throw` path is kept for SSR where there is no `window`.

---

## 2026-05-26 (129) — Phase 4: Drop Content-Type header on bodyless requests

**Files changed:**
- `apps/web/lib/api.ts`: `Content-Type: application/json` is now only added when `body !== undefined`. GET and DELETE requests no longer carry the header, preventing proxy rejections on strict intermediaries.

---

## 2026-05-26 (128) — Phase 4: Fix concurrent 401 race condition in api.ts

**Files changed:**
- `apps/web/lib/api.ts`: Added module-level `refreshPromise: Promise<boolean> | null` singleton. `callRefresh()` now returns the in-flight promise when one already exists, so concurrent 401 responses all await the same refresh call. The singleton is cleared in `.finally()` so subsequent expirations trigger a fresh refresh.

---

## 2026-05-26 (127) — Phase 4: Typed domain hooks

**Files changed:**
- `apps/web/lib/hooks/use-auth.ts` *(new)*: `useLogin`, `useRegister`, `useForgotPassword`, `useLogout` — all `useMutation` wrappers over `api.post`.
- `apps/web/lib/hooks/use-user.ts` *(new)*: `useMe` (query), `useUpdateMe` (mutation with cache write-back); exports `UserProfile` type.
- `apps/web/lib/hooks/use-events.ts` *(new)*: `useEvents`, `useEventDetail`, `useInviteLink` (queries); `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`, `useRegenerateInvite`, `useJoinEvent`, `useAddMember`, `useRemoveMember` (mutations). Exports `EventListItem`, `EventDetail`, `EventMember` types. Invalidates related queries on mutation success.
- `apps/web/lib/hooks/use-expenses.ts` *(new)*: `useExpenses` (query); `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense` (mutations). Expense mutations also invalidate the balances query since amounts affect net positions.
- `apps/web/lib/hooks/use-balances.ts` *(new)*: `useBalances` (query). Exports `BalanceResult`, `MemberBalance`, `SettlementSuggestion` types.
- `apps/web/lib/hooks/use-settlements.ts` *(new)*: `useSettlements` (query); `useCreateSettlement`, `useConfirmSettlement`, `useDeleteSettlement` (mutations). `confirmSettlement` also invalidates balances (confirmed settlements change net positions).
- `apps/web/lib/hooks/use-messages.ts` *(new)*: `useMessages` (query with optional cursor), `useSendMessage` (mutation).
- `apps/web/lib/hooks/use-notifications.ts` *(new)*: `useSendReminder` mutation.
- `apps/web/lib/hooks/use-export.ts` *(new)*: `useExportPdf` mutation returning `{ url: string }`.
- `apps/web/lib/hooks/use-admin.ts` *(new)*: `useAdminStats`, `useAdminUsers`, `useAdminEvents` (queries with pagination params); `useUpdateUserStatus`, `useArchiveEvent` (mutations). Exports `AdminStats`, `AdminUser`, `AdminEventItem`, `Paginated<T>` types.

---

## 2026-05-26 (126) — Phase 4: TanStack Query provider

**Files changed:**
- `apps/web/components/providers/query-provider.tsx` *(new)*: `'use client'` wrapper around `QueryClientProvider`. Creates the `QueryClient` inside a `useState` initialiser so each browser session gets exactly one client instance (avoids the shared-singleton pitfall with SSR). Default options: `staleTime: 30s`, `retry: 1`.
- `apps/web/app/layout.tsx`: Wraps `{children}` and `<Toaster />` with `<QueryProvider>` so every page in the app has access to the query context.
- `apps/web/package.json`: Added `@tanstack/react-query@^5`.

---

## 2026-05-26 (125) — Phase 4: Typed fetch wrapper (api.ts)

**Files changed:**
- `apps/web/lib/api.ts` *(new)*: Typed fetch wrapper for all client-side API calls. Features:
  - Prepends `NEXT_PUBLIC_API_URL/api/v1` to every request path.
  - Sends `credentials: 'include'` so HttpOnly JWT cookies are forwarded automatically.
  - On 401, calls `POST /auth/refresh` once and retries the original request.
  - On repeated 401 (refresh also fails), redirects to `/login` (client-side only).
  - Throws `ApiError` (with `.status` and `.data` fields) for all non-2xx responses.
  - Exports `api.get`, `api.post`, `api.patch`, `api.delete` — all fully generic.

---

## 2026-05-26 (124) — Admin module integration tests + e2e ESM fix

**Files changed:**
- `apps/api/test/admin.e2e-spec.ts` *(new)*: 25 integration tests covering all five admin endpoints against the real Neon DB. Isolation via per-run `RUN_ID` prefix on emails and event names; cleanup in `afterAll`. Users and events created via the API; admin role promoted via Prisma directly to avoid bootstrapping a separate admin registration flow. Test coverage:
  - `GET /admin/stats` — 200 with correct field shape; `totalVnd` is a JS `number`; 403 non-admin; 401 unauthenticated.
  - `GET /admin/users` — 200 with paginated shape; `passwordHash` absent; `?page=1&limit=1` respected; 403; 401.
  - `PATCH /admin/users/:id` — 200 deactivate; 200 reactivate; 400 when target is ADMIN; 404; 403; 401.
  - `GET /admin/events` — 200 with paginated shape including `organizer` and `_count.members`; pagination respected; 403; 401.
  - `PATCH /admin/events/:id/archive` — 200 ACTIVE→ARCHIVED; 400 already ARCHIVED; 404; 403; 401.
- `apps/api/test/jest-e2e.json`: added `moduleNameMapper` entry to route `@react-pdf/renderer` to a CJS stub, fixing the ESM parse error that caused **all** e2e test suites to fail since the Export module was added.
- `apps/api/test/__mocks__/@react-pdf/renderer.js` *(new)*: CJS stub returning no-op React components and a `renderToBuffer` mock that resolves to `Buffer.from('mock-pdf')`. The admin and other e2e suites do not exercise the PDF export endpoint, so a stub is safe; the stub prevents the ESM import from crashing the Jest runtime.

---

## 2026-05-26 (123) — Admin module unit tests for AdminService

**Files changed:**
- `apps/api/src/admin/admin.service.spec.ts` *(new)*: 18 unit tests covering all five methods in `AdminService`:
  - `getStats` — returns correct fields including `activeEvents` / `archivedEvents` breakdown; handles `null` aggregate sum (0 expenses → `totalVnd: 0`); confirms `totalVnd` is a plain JS `number` (guards against Prisma `Decimal` serialisation regression).
  - `getUsers` — pagination `skip`/`take` logic; `totalPages` ceiling calculation; verifies `passwordHash` is absent from both the `select` argument and the returned items.
  - `updateUserStatus` — 404 when user not found; 400 when target is ADMIN; deactivate path calls `refreshToken.deleteMany`; activate path skips token deletion.
  - `getEvents` — `deletedAt: null` filter passed to `findMany`; correct `skip` for page 3; `_count.members` where clause includes `status: ACTIVE, removedAt: null`.
  - `archiveEvent` — 404 when event not found / soft-deleted; 400 when already ARCHIVED; happy path for ACTIVE and SETTLED events.

---

## 2026-05-26 (122) — Admin module QA fix S3: rate limit admin write endpoints

**Files changed:**
- `apps/api/src/admin/admin.controller.ts`:
  - Added `Throttle` import from `@nestjs/throttler`.
  - Applied `@Throttle({ default: { ttl: 60_000, limit: 10 } })` to `PATCH /admin/users/:id` and `PATCH /admin/events/:id/archive`. Both endpoints now enforce 10 requests per minute per IP, overriding the global 60 req/min bucket. This prevents a compromised admin JWT from being scripted to mass-deactivate users or archive events before being detected and revoked.

---

## 2026-05-26 (121) — Admin module QA fix S2: revoke refresh tokens on user deactivation

**Files changed:**
- `apps/api/src/admin/admin.service.ts`: `updateUserStatus` — after the `user.update` call, when `dto.isActive` is `false`, runs `refreshToken.deleteMany({ where: { userId } })` to purge all refresh token rows for that user. The 15-minute access token will naturally expire and `JwtAuthGuard`'s `isActive` check will reject any new access token obtained before expiry; the refresh token purge closes the remaining 7-day window where the deactivated user could otherwise silently obtain a new access token pair. When re-activating (`isActive: true`), no token action is needed — the user must log in again to get fresh tokens.

---

## 2026-05-26 (120) — Admin module QA fix S1: hide "Quản trị" nav link for non-admin users

**Files changed:**
- `apps/web/app/(app)/layout.tsx`: converted to a server component that reads the `access_token` cookie from `next/headers` and base64-decodes the JWT payload to extract `role`. The "Quản trị" link to `/admin` is now only rendered when `role === 'ADMIN'`. Non-admin users no longer see the link in the header navigation. No extra dependencies added — `Buffer.from(..., 'base64url')` is available in the Node.js runtime. The decode is purely for UI gating; the API's `@Roles(UserRole.ADMIN)` guard enforces actual access control.

---

## 2026-05-26 (119) — Admin module QA fix F3: totalVnd converts Prisma Decimal to JS number

**Files changed:**
- `apps/api/src/admin/admin.service.ts`: `getStats` — wrapped `vndResult._sum.amount ?? 0` with `Number(...)`. Prisma's `aggregate._sum` returns a `Decimal` object (from the `decimal.js` library), not a plain JS number. Without the conversion, `JSON.stringify` serialises it as a string (e.g. `"500000"`) or an object, breaking any client that expects an integer. `Number()` coerces it to a native number before the response is serialised.

---

## 2026-05-26 (118) — Admin module QA fix F2: getEvents member count excludes PENDING members

**Files changed:**
- `apps/api/src/admin/admin.service.ts`:
  - Added `MemberStatus` to the `@prisma/client` import.
  - `getEvents`: updated `_count.members` filter from `{ removedAt: null }` to `{ status: MemberStatus.ACTIVE, removedAt: null }`. PENDING members (invited but not yet accepted) are no longer counted, matching the fix already applied to `EVENT_LIST_SELECT` in the events service (entry 71).

---

## 2026-05-26 (117) — Admin module QA fix F1: getStats adds activeEvents / archivedEvents breakdown

**Files changed:**
- `apps/api/src/admin/admin.service.ts`: `getStats` now runs two additional parallel Prisma `count` queries — one filtered to `status: EventStatus.ACTIVE` and one to `status: EventStatus.ARCHIVED` (both still exclude soft-deleted events via `deletedAt: null`). Response now includes `activeEvents` and `archivedEvents` fields alongside the existing `totalEvents`, satisfying spec §5.10 which requires "total events (active / archived)".

---

## 2026-05-26 (116) — Admin module

**Files added:**
- `apps/api/src/admin/admin.module.ts`
- `apps/api/src/admin/admin.controller.ts` — all 5 endpoints, `@Roles(ADMIN)` on the controller class
- `apps/api/src/admin/admin.service.ts` — business logic + Prisma queries
- `apps/api/src/admin/dto/paginate.dto.ts` — `page` / `limit` query params with validation
- `apps/api/src/admin/dto/update-user-status.dto.ts` — `{ isActive: boolean }`

**Files modified:**
- `apps/api/src/app.module.ts` — registered `AdminModule`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/stats` | Total users, events, VND tracked |
| `GET` | `/api/v1/admin/users?page=1&limit=20` | Paginated user list |
| `PATCH` | `/api/v1/admin/users/:id` | Activate / deactivate (guards against changing other admins) |
| `GET` | `/api/v1/admin/events?page=1&limit=20` | Paginated event list (excludes soft-deleted) |
| `PATCH` | `/api/v1/admin/events/:id/archive` | Force-archive any event |

**Guards:** All endpoints require `UserRole.ADMIN` via `@Roles` + the global `RolesGuard`. Non-admins get 403.

---

## 2026-05-26 (115) — Export module: PDF generation

**Files added:**
- `apps/api/src/export/export.module.ts` — NestJS module wiring `ExportController`, `ExportService`, `BalanceService`, and `UploadModule`
- `apps/api/src/export/export.controller.ts` — `POST /events/:eventId/export/pdf` — JWT-protected, members only
- `apps/api/src/export/export.service.ts` — fetches event data + balances, calls PDF generator, uploads to Cloudinary, returns `{ url }`
- `apps/api/src/export/pdf.generator.ts` — builds a multi-section A4 PDF using `@react-pdf/renderer` (`React.createElement` API, no JSX): event summary, expense list, member balances, suggested settlements, settlement history

**Files modified:**
- `apps/api/src/app.module.ts` — added `ExportModule` to imports
- `apps/api/package.json` — added `@react-pdf/renderer`, `react`, `react-dom`, `@types/react`, `@types/react-dom`

**Behaviour:**
- `POST /api/v1/events/:id/export/pdf` → 200 `{ url: "https://res.cloudinary.com/…" }`
- Any active member can export; non-members get 403, deleted events get 404
- When Cloudinary is not configured, returns a mock URL (dev mode)

---

## 2026-05-26 (114) — Messages module integration tests (e2e)

**Files added:**
- `apps/api/test/messages.e2e-spec.ts` — 17 integration tests against the real Neon DB covering:
  - `GET /events/:id/messages`: 200 for organizer and member, correct response shape, `nextCursor: null` when page not full, 400 for invalid UUID cursor, 403 for non-member, 401 unauthenticated, 404 for non-existent event
  - `POST /events/:id/messages`: 201 for organizer and member, posted message appears in GET history, 400 for empty/oversized/missing content, 403 for non-member, 401 unauthenticated, 404 for non-existent event

---

## 2026-05-26 (113) — Messages module unit tests: MessagesService + MessagesGateway

**Files added:**
- `apps/api/src/messages/messages.service.spec.ts` — 15 unit tests covering:
  - `getMessages`: returns messages in chronological order, correct `nextCursor` when full/partial page, passes cursor to Prisma, 404 when event not found, 403 when non-member
  - `createMessage`: creates message, 404 when event not found, 403 when non-member
  - `isActiveMember`: returns `true` for ACTIVE member, `false` when no matching row, queries with correct filters including `event: { deletedAt: null }`
- `apps/api/src/messages/messages.gateway.spec.ts` — 11 unit tests covering:
  - `handleConnection`: sets `socket.user` with valid token (auth field or cookie), disconnects on missing token, disconnects on verification failure
  - `handleJoinRoom`: joins room for active member, throws `WsException` for unauthenticated socket, throws `WsException` for non-member
  - `handleSendMessage`: saves message and broadcasts to room excluding sender, returns message as ack, throws for unauthenticated, empty content, content > 2000 chars, rate limit exceeded
  - `handleDisconnect`: clears rate-limit bucket on disconnect

---

## 2026-05-26 (112) — Messages module missing feature F3: WebSocket + REST polling fallback

**Files added / modified:**
- `apps/web/package.json` — added `socket.io-client@^4.8.3` dependency
- `apps/web/app/(app)/events/[id]/chat/page.tsx` — fully rewritten from mock data to real API:
  - **Initial load:** `GET /api/v1/events/:id/messages` on mount
  - **WebSocket:** connects `socket.io` with `withCredentials: true`; on `connect`, joins the event room and listens for `newMessage`; on disconnect, automatically falls back to polling
  - **Polling fallback:** 5-second `setInterval` calling `GET /api/v1/events/:id/messages`; starts immediately if WS `connect_error` fires or if socket is not connected within 5 s; stops when WS reconnects
  - **Send:** uses `socket.emit('sendMessage', ...)` when WS is connected; falls back to `POST /api/v1/events/:id/messages` when offline; draft is restored on send failure
  - **Dedup:** `mergeMessages()` dedups by message ID so polling and WS events never cause duplicates
  - **Status banner:** shows "Đang kết nối…" while connecting, "đang tự động cập nhật mỗi 5 giây" when in polling mode
  - **isMe detection:** calls `GET /api/v1/users/me` to get current user name; messages whose `member.user.name` matches are right-aligned with dark bubble

---

## 2026-05-26 (111) — Messages module QA fix M4: isActiveMember checks event soft-delete

**Files modified:**
- `apps/api/src/messages/messages.service.ts` — `isActiveMember` query now includes `event: { deletedAt: null }` in the Prisma `where` clause. A socket can no longer successfully `joinRoom` for a soft-deleted event because the member lookup returns `null` even when a valid `EventMember` row exists, causing `handleJoinRoom` to throw `WsException`.

---

## 2026-05-26 (110) — Messages module QA fix M3: validate cursor as UUID in GetMessagesDto

**Files modified:**
- `apps/api/src/messages/dto/get-messages.dto.ts` — replaced `@IsString()` with `@IsUUID()` on the `cursor` field. Invalid cursor values (e.g. `?cursor=foo`) now return HTTP 400 from the global `ValidationPipe` before reaching Prisma, preventing a Prisma runtime error from surfacing as an HTTP 500 with a stack trace.

---

## 2026-05-26 (109) — Messages module QA fix S2: per-socket rate limit on sendMessage

**Files modified:**
- `apps/api/src/messages/messages.gateway.ts` — added `RateLimitBucket` interface and `WS_RATE_LIMIT` constant (10 messages / 10-second window per socket). Private `checkRateLimit(socketId)` method maintains a sliding-window counter in `rateLimitMap`; throws `WsException` with a Vietnamese retry-after message when the limit is exceeded. `handleSendMessage` calls `checkRateLimit` before any DB work. `handleDisconnect` cleans up the socket's bucket from the map to prevent memory leaks.

---

## 2026-05-26 (108) — Messages module QA fix S1: restrict WebSocket CORS to app origin

**Files modified:**
- `apps/api/src/messages/messages.gateway.ts` — `@WebSocketGateway` CORS `origin` changed from `true` (reflect any origin) to `process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'`. Matches the HTTP CORS restriction already in `main.ts`, preventing arbitrary third-party sites from opening credentialed WebSocket connections.

---

## 2026-05-26 (107) — Messages module QA fix F2: sender receives newMessage twice

**Files modified:**
- `apps/api/src/messages/messages.gateway.ts` — `handleSendMessage` now uses `socket.to(room).emit('newMessage', message)` instead of `this.server.to(room).emit(...)`. `socket.to()` broadcasts to all sockets in the room *except* the sender; the sender receives the message only via the acknowledgment return value, preventing duplicate display on the client.

---

## 2026-05-26 (106) — Messages module QA fix F1: validate WebSocket message content

**Files modified:**
- `apps/api/src/messages/messages.gateway.ts` — `handleSendMessage` now validates `content` before calling `createMessage`: trims whitespace, rejects empty string with `WsException('Nội dung tin nhắn không được để trống')`, and rejects content over 2000 chars with `WsException('Nội dung tin nhắn không được vượt quá 2000 ký tự')`. Mirrors the constraints already enforced by `SendMessageDto` on the REST path.

---

## 2026-05-26 (105) — Phase 3: Messages module (REST + Socket.io gateway)

**Files added:**
- `apps/api/src/messages/dto/send-message.dto.ts` — DTO with `content` (non-empty string, max 2000 chars)
- `apps/api/src/messages/dto/get-messages.dto.ts` — DTO with optional `cursor` (UUID) and `limit` (1–100, default 50) for cursor-based pagination
- `apps/api/src/messages/messages.service.ts` — `getMessages`, `createMessage`, `isActiveMember`; verifies event exists + caller is ACTIVE member before every operation
- `apps/api/src/messages/messages.gateway.ts` — Socket.io WebSocket gateway; authenticates via `access_token` cookie or `auth.token` handshake field; implements `joinRoom`, `leaveRoom`, `sendMessage` events and emits `newMessage` to the event room; exposes `broadcastMessage` for the REST controller
- `apps/api/src/messages/messages.controller.ts` — `GET /events/:eventId/messages` (cursor-paginated) and `POST /events/:eventId/messages` (REST fallback that also broadcasts via gateway)
- `apps/api/src/messages/messages.module.ts` — imports `JwtModule` for gateway token verification

**Files modified:**
- `apps/api/src/app.module.ts` — registered `MessagesModule`
- `apps/api/src/main.ts` — added `app.useWebSocketAdapter(new IoAdapter(app))` so Socket.io is backed by the correct adapter
- `apps/api/package.json` — added `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` dependencies

**Pagination design:**
- `GET /events/:id/messages?limit=50&cursor=<msgId>` returns up to `limit` messages in chronological order
- Messages are fetched `DESC` (newest first) then reversed for display
- `nextCursor` is the ID of the oldest message in the page — the client passes it to load an earlier batch ("load more" scrolling up)
- No cursor → latest messages (initial load)

**Auth for WebSocket:**
- Connection handler extracts JWT from `access_token` cookie or `socket.handshake.auth.token`
- Invalid or missing token → socket disconnects immediately

**All 129 existing unit tests pass.**

---

## 2026-05-26 (104) — Phase 3: Integration tests for Notifications endpoint (M1)

**File added:**
- `apps/api/test/notifications.e2e-spec.ts` (**new**): 10 integration tests (Supertest + Neon DB) covering `POST /events/:eventId/reminders`.

**Isolation strategy:** per-run `RUN_ID = e2e-notif-${Date.now()}` prefix; stale rows cleaned in `beforeAll`, created rows deleted in `afterAll` (events before users to respect the `organizerId` FK). A `beforeEach` resets `lastReminderAt = null` on the debtor member so cooldown tests don't bleed across cases.

**Member setup:** organizer creates the event (auto-added as ORGANIZER); the debtor is inserted directly via Prisma as an ACTIVE MEMBER, bypassing the invite flow.

**Tests:**
- `200` — organizer sends reminder → `{ ok: true, sentTo, lastReminderAt }`
- `200` — `lastReminderAt` is a valid ISO timestamp
- `403` — regular MEMBER cannot send reminder
- `403` — user not in the event cannot send reminder
- `400` — second reminder within 24 h is rejected (cooldown gate)
- `400` — cooldown error message contains "giờ" (remaining hours)
- `404` — event does not exist
- `404` — member ID does not exist in the event
- `401` — unauthenticated request
- `400` — missing `memberId` in request body (DTO validation)

**All 10 tests pass.**

---

## 2026-05-26 (103) — Phase 3: Unit tests for NotificationsService (M1)

**File added:**
- `apps/api/src/notifications/notifications.service.spec.ts` (**new**): 13 unit tests covering all code paths of `sendReminder`.

**Tests by scenario:**
- `happy path — returns ok, sentTo and lastReminderAt` — verifies response shape
- `happy path — calls updateMany to atomically claim rate-limit slot` — confirms the conditional update is called with the correct args
- `throws 404 when event does not exist`
- `throws 403 when caller is not a member of the event` (empty members array)
- `throws 403 when caller is MEMBER, not ORGANIZER`
- `throws 404 when target member does not exist in the event`
- `throws 400 when target member is a guest (no user account)`
- `throws 400 with remaining hours when in cooldown window` (updateMany returns count=0)
- `error message includes remaining hours when in cooldown` — regex match for "23 giờ"
- `does not call updateMany when target member is not found` — guard fires before rate-limit
- `does not call updateMany when caller is not organizer` — guard fires before rate-limit
- `computes amountOwed = 0 when member is a creditor (net > 0)` — net positive → amountOwed=0, send still succeeds
- `computes correct amountOwed for a debtor` — net negative → amountOwed=abs(net), send succeeds

**All 13 tests pass.**

---

## 2026-05-26 (102) — Phase 3: Fix rate-limit TOCTOU race condition in sendReminder (S1) + mark S3 done

**File changed:**
- `apps/api/src/notifications/notifications.service.ts`

**Problem (S1):** The old pattern was read → check → write. Two concurrent requests could both read `lastReminderAt = null`, both pass the check, and both proceed to send an email — violating the 24-hour per-member limit.

**Fix:** Replaced the separate read-check and write steps with a single atomic `updateMany` that includes the cooldown condition in its `WHERE` clause:
```
WHERE id = :memberId AND (lastReminderAt IS NULL OR lastReminderAt < :cooldownThreshold)
```
Only one of two concurrent requests will successfully update the row (`count = 1`); the other sees `count = 0` and is rejected. The previously-fetched `lastReminderAt` is still used to compute the human-readable remaining hours in the error message.

**Also marked done (S3):** Fix reminder link → `/events/:eventId` was already applied in entry 101 when the email template was rewritten; marking the checklist item as complete.

---

## 2026-05-26 (101) — Phase 3: Fix reminder email — amount owed, event link, MoMo/VNPay links (F4)

**File changed:**
- `apps/api/src/notifications/notifications.service.ts`

**Problem:** The reminder email only contained the event name and a generic `/dashboard` link. Spec §5.7 requires four mandatory contents: event name, amount owed, a link to the specific event, and MoMo/VNPay payment links.

**Changes:**
1. Added `SettlementStatus` import from `@prisma/client`.
2. Extended the `targetMember` Prisma query to also fetch `paidExpenses`, `expenseSplits`, `sentSettlements` (CONFIRMED), and `receivedSettlements` (CONFIRMED).
3. Calculated `amountOwed` using the same formula as `BalancesController`: `net = totalPaid − totalOwed + settlementsPaid − settlementsReceived`; if net < 0, `amountOwed = Math.abs(net)`, otherwise 0.
4. Updated `sendReminderEmail()` to accept `eventId` and `amountOwed` parameters.
5. Email now includes:
   - Amount owed formatted as VND (e.g. `150.000 ₫`)
   - Direct link to `/events/:eventId`
   - Generic MoMo (`nhantien.momo.vn`) and VNPay (`vnpay.vn`) payment links
   - Link to `/events/:eventId/settlements` to record payment in-app

---

## 2026-05-26 (100) — Phase 3: Integration tests for Settlements endpoints (M1)

**Files added:**
- `apps/api/test/settlements.e2e-spec.ts` (**new**): 23 integration tests (Supertest + Neon DB) covering all four Settlements endpoints.

**Isolation strategy:** per-run `RUN_ID = e2e-sett-${Date.now()}` prefix on emails and event names; stale rows cleaned in `beforeAll`, created rows deleted in `afterAll` (events before users to respect the `organizerId` FK).

**Member setup:** organizer creates the event (auto-added as ORGANIZER member); payer and recipient are inserted directly via Prisma as ACTIVE members, bypassing the invite flow.

**Tests by group:**
- `POST /settlements` (7 tests): 201 PENDING with correct body; method defaults to CASH; 400 fromId=toId; 400 amount=0; 403 non-member; 404 unknown event; 401 unauthenticated.
- `GET /settlements` (3 tests): 200 member gets list; 403 non-member; 401 unauthenticated.
- `PATCH confirm` (6 tests): 200 recipient confirms; 200 organizer confirms; 403 payer (not recipient/organizer); 400 already CONFIRMED; 404 unknown settlement; 401 unauthenticated.
- `DELETE` (7 tests): 204 payer; 204 recipient; 204 organizer; 403 unrelated member; 400 CONFIRMED; 404 unknown settlement; 401 unauthenticated.

**Side fix:** applied pending DB migration `20260526_add_last_reminder_at_to_event_members` (`ALTER TABLE event_members ADD COLUMN "lastReminderAt" TIMESTAMP(3)`) which was required for `POST /events` to succeed during setup.

---

## 2026-05-26 (99) — Phase 3: Unit tests for SettlementsService (M1)

**Files added:**
- `apps/api/src/settlements/settlements.service.spec.ts` (**new**): 23 unit tests covering all three public methods.

  **`createSettlement` (8 tests):** happy path → 201 with PENDING status; event not found → 404; event SETTLED → 400; event ARCHIVED → 400; caller not a member → 403; fromId = toId → 400; fromMember not found/ACTIVE → 404; toMember not found/ACTIVE → 404.

  **`confirmSettlement` (7 tests):** recipient can confirm; organizer can confirm; non-recipient/organizer → 403; already CONFIRMED → 400; event SETTLED → 400; event ARCHIVED → 400; settlement not found → 404.

  **`deleteSettlement` (8 tests):** payer can delete; recipient can delete (F2 fix); organizer can delete; non-authorized → 403; CONFIRMED → 400; event not found → 404; settlement not found → 404; caller not a member → 403.

**Implementation note:** Uses `jest.resetAllMocks()` (not `clearAllMocks`) in `beforeEach` to prevent stale `mockResolvedValueOnce` queue entries from leaking between tests when early-exit guards fire before `eventMember.findFirst` is called.

---

## 2026-05-26 (98) — Phase 3: Fix deep-link generator — encode phone and bankAccount (S2)

**Problem:** `phone` and `bankAccount` were interpolated raw into URLs. A value like `+84912345678` encodes `+` as a space in query strings; values with spaces or special chars break the URL entirely, causing MoMo/VNPay to fail parsing.

**Files changed:**
- `apps/api/src/settlements/payment-deeplinks.ts`:
  - `generateMomoDeepLink`: added `encodedPhone = encodeURIComponent(phone)`; used in both `deepLink` and `webUrl`.
  - `generateVNPayDeepLink`: added `encodedAccount = encodeURIComponent(bankAccount)`; used in both `deepLink` and `webUrl`.
  - `note` and `description` were already encoded — unchanged.

---

## 2026-05-26 (97) — Phase 3: Audit Settlement.method default (M3 — no change needed)

**Audit result:** `Settlement.method` is safe as-is. Verified:
- Prisma schema: `method SettlementMethod @default(CASH)` ✅
- Migration SQL: `"method" "SettlementMethod" NOT NULL DEFAULT 'CASH'` ✅

The column is `NOT NULL` with a DB-level default, so `null` is structurally impossible. When `dto.method` is omitted (`undefined`), Prisma omits the field from the `INSERT` and the DB applies `CASH`. No code change was required.

---

## 2026-05-26 (96) — Phase 3: Fix createSettlement — require ACTIVE status for both members (M2)

**Problem:** `createSettlement` only filtered `removedAt: null` when looking up `fromMemberId` and `toMemberId`. A member with `status: PENDING` (invited but not yet accepted) could be a party in a settlement, which is logically invalid.

**Files changed:**
- `apps/api/src/settlements/settlements.service.ts`: added `status: MemberStatus.ACTIVE` to both `eventMember.findFirst` queries for `fromMemberId` and `toMemberId`; updated error messages to mention "chưa là thành viên chính thức" so it's clear the member exists but is not ACTIVE.

---

## 2026-05-26 (95) — Phase 3: Fix confirmSettlement — guard SETTLED/ARCHIVED event (M4)

**Problem:** `createSettlement` already blocked SETTLED/ARCHIVED events, but `confirmSettlement` had no such guard. A settlement created before the event was closed could still be confirmed after the fact, corrupting historical balances.

**Files changed:**
- `apps/api/src/settlements/settlements.service.ts`: added `EventStatus` check immediately after the event null-check in `confirmSettlement` — throws `400 BadRequestException` if status is `SETTLED` or `ARCHIVED`.

---

## 2026-05-26 (94) — Phase 3: Fix confirmSettlement — email organizer on confirmation (F3)

**Problem:** spec §5.5 requires the organizer to receive an email notification when a settlement is confirmed. The service had no email logic and did not even look up the organizer.

**Files changed:**
- `apps/api/src/settlements/settlements.service.ts`:
  - Added `Logger` and `escapeHtml` helper (same pattern as `NotificationsService`).
  - Expanded event query in `confirmSettlement` to fetch the active organizer's `user.email` and `user.name`.
  - Captured the `settlement.update` result as `updated` instead of returning it directly.
  - Fire-and-forget call to new private `sendSettlementConfirmedEmail(email, organizerName, eventName, payerNickname, recipientNickname, amount, eventId)` after the DB update.
  - `sendSettlementConfirmedEmail`: logs to console in dev (no `RESEND_API_KEY`); sends a Vietnamese-language HTML email via Resend in production with payer, recipient, amount, and a direct link to `/events/:id/settlements`; errors are caught and logged, not thrown.

---

## 2026-05-26 (93) — Phase 3: Fix deleteSettlement — allow recipient to reject (F2)

**Problem:** spec §5.5 states "organizer or recipient can reject" a settlement, but `deleteSettlement` only allowed the payer or organizer. The recipient had no way to reject a payment they didn't receive.

**Files changed:**
- `apps/api/src/settlements/settlements.service.ts`: added `toMember: { select: { userId: true } }` to the settlement include; added `isRecipient` check (`settlement.toMember.userId === callerId`); updated the authorization guard to `!isPayer && !isRecipient && !isOrganizer`; updated the error message to mention recipient.

---

## 2026-05-26 (92) — Phase 3: Fix balance calculation to include confirmed settlements (F1)

**Problem:** `GET /events/:id/balances` ignored confirmed settlements, so balances remained unchanged after a settlement was confirmed. Violated spec §5.4 and §5.5.

**Files changed:**
- `apps/api/src/expenses/balances.controller.ts`: added `sentSettlements` and `receivedSettlements` (filtered to `status: CONFIRMED`) to the Prisma member select. Net balance now computed as `totalExpensesPaid − totalExpenseSplitsOwed + totalSettlementsPaid − totalSettlementsReceived`. Both relations already existed on `EventMember` in the Prisma schema.

---

## 2026-05-26 (91) — Phase 3: Notifications module

**Files added:**
- `apps/api/src/notifications/dto/send-reminder.dto.ts` (**new**): `SendReminderDto` — required `memberId` string.
- `apps/api/src/notifications/notifications.service.ts` (**new**): `NotificationsService.sendReminder()` — guards: caller must be ORGANIZER; target member must be ACTIVE and have a registered user account (guests cannot receive email); 24-hour rate-limit per member via `lastReminderAt` (`429`-style `400` with remaining hours in message); updates `lastReminderAt` atomically before sending (prevents double-send on concurrent calls); fires `sendReminderEmail()` as non-blocking background call (`void`). `sendReminderEmail()`: logs in dev when `RESEND_API_KEY` is absent; sends Vietnamese-language HTML reminder via Resend in production with the dashboard link; errors are caught and logged, not thrown.
- `apps/api/src/notifications/notifications.controller.ts` (**new**): `POST /events/:eventId/reminders` → 200 `{ ok, sentTo, lastReminderAt }`.
- `apps/api/src/notifications/notifications.module.ts` (**new**): NestJS module wiring controller + service.

**Schema changed:**
- `apps/api/prisma/schema.prisma`: added `lastReminderAt DateTime?` to `EventMember`.
- `apps/api/prisma/migrations/20260526_add_last_reminder_at_to_event_members/migration.sql` (**new**): `ALTER TABLE "event_members" ADD COLUMN "lastReminderAt" TIMESTAMP(3)`.

**Files changed:**
- `apps/api/src/app.module.ts`: registered `NotificationsModule`.

---

## 2026-05-26 (90) — Phase 3: Settlements module

**Files added:**
- `apps/api/src/settlements/dto/create-settlement.dto.ts` (**new**): `CreateSettlementDto` — required `fromMemberId`, `toMemberId` (non-empty strings), `amount` (integer ≥ 1); optional `method` (`SettlementMethod` enum, defaults to CASH) and `proofUrl` (`@IsUrl`).
- `apps/api/src/settlements/settlements.service.ts` (**new**): `SettlementsService` with four methods:
  - `createSettlement`: verifies event is not SETTLED/ARCHIVED; caller must be ACTIVE member; from ≠ to; both `fromMemberId`/`toMemberId` must belong to the event; creates `Settlement` with `status: PENDING`.
  - `getSettlements`: verifies event exists; caller must be ACTIVE member; returns all settlements ordered by `createdAt DESC` with `fromMember` and `toMember` included.
  - `confirmSettlement`: verifies event exists; caller must be ACTIVE member; settlement must be PENDING; only the recipient (`toMember.userId`) or ORGANIZER may confirm; sets `status: CONFIRMED` and `confirmedAt`.
  - `deleteSettlement`: verifies event exists; caller must be ACTIVE member; settlement must be PENDING (CONFIRMED cannot be deleted); only the payer (`fromMember.userId`) or ORGANIZER may delete.
- `apps/api/src/settlements/settlements.controller.ts` (**new**): `SettlementsController` at `events/:eventId/settlements` — `POST` → 201, `GET` → 200, `PATCH :settlementId/confirm` → 200, `DELETE :settlementId` → 204.
- `apps/api/src/settlements/settlements.module.ts` (**new**): NestJS module wiring controller + service.
- `apps/api/src/settlements/payment-deeplinks.ts` (**new**): two pure utility functions:
  - `generateMomoDeepLink({ phone, amount, note })` → `{ deepLink, webUrl }`. Deep-link uses `momo://transfer`; web fallback uses `nhantien.momo.vn`.
  - `generateVNPayDeepLink({ bankAccount, amount, description })` → `{ deepLink, webUrl }`. Deep-link uses `vnpay://transfer`; web fallback uses `vnpay.vn/transfer`.

**Files changed:**
- `apps/api/src/app.module.ts`: registered `SettlementsModule`.

---


All notable changes to the project are documented here.
Format: `[YYYY-MM-DD] [Phase] Description`

---

## 2026-05-25 (89) — Phase 3: Cloudinary upload service (receipt photos)

**Files changed:**
- `apps/api/src/upload/cloudinary.service.ts` (**new**): `CloudinaryService` — configured via `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`; gracefully degrades to mock responses when env vars are absent (dev/test). Methods: `generateSignedUploadParams(folder)` returns signed params for direct browser→Cloudinary uploads (files never pass through NestJS); `uploadBuffer(buffer, folder)` for server-side uploads (used by future export module); `deleteFile(publicId)` for cleanup.
- `apps/api/src/upload/upload.controller.ts` (**new**): `GET /api/v1/upload/sign?folder=receipts` → 200 with `{ signature, timestamp, apiKey, cloudName, folder }`. Defaults to `folder=receipts` if omitted.
- `apps/api/src/upload/upload.module.ts` (**new**): exports `CloudinaryService` so it can be injected by future modules (export, etc.).
- `apps/api/src/app.module.ts`: registered `UploadModule`.

---

## 2026-05-25 (88) — Phase 3: Expenses module — Balance calculation service unit tests

**Files changed:**
- `apps/api/src/expenses/balance.service.spec.ts` (**new**): 14 unit tests covering `simplifyDebts()` and `BalanceService.compute()` — no DB mocking needed (pure functions). Cases: empty input, all-zero nets, creditor-only/debtor-only (no settlements), exact 1-to-1 match, partial creditor match, classic 3-way equal split, 3-debtor-2-creditor minimisation, members with net = 0 excluded, large VND integers, nickname propagation; plus 3 `BalanceService` wrapper tests.

---

## 2026-05-25 (87) — Phase 3: Expenses module — GET /events/:id/balances (debt simplification)

**Files changed:**
- `apps/api/src/expenses/balance.service.ts` (**new**): `BalanceService.compute()` wraps the pure `simplifyDebts()` function. Algorithm: sort creditors (net > 0) and debtors (net < 0) by absolute value, greedily match largest pairs, emitting one `SettlementSuggestion` per pairing until all balances reach zero — O(n log n), minimum number of transactions.
- `apps/api/src/expenses/balances.controller.ts` (**new**): `GET /events/:eventId/balances` → 200. Loads all ACTIVE members with their paid-expense totals and split totals via a single Prisma query, computes `net = totalPaid − totalOwed` per member, delegates to `BalanceService.compute()`. Returns `{ members: [...], settlements: [...] }`.
- `apps/api/src/expenses/expenses.module.ts`: registered `BalancesController` and `BalanceService`; exports `BalanceService` for upcoming unit-test task.

---

## 2026-05-25 (86) — Phase 3: Expenses module — DELETE /events/:id/expenses/:expenseId (soft delete)

**Files changed:**
- `apps/api/src/expenses/expenses.service.ts`: added `deleteExpense()` — blocks deletion on SETTLED/ARCHIVED events; guards: caller must be the `paidBy` member (creator) or ORGANIZER; sets `deletedAt = now()` (soft delete — splits are preserved in DB for balance history).
- `apps/api/src/expenses/expenses.controller.ts`: added `DELETE /events/:eventId/expenses/:expenseId` → 204 No Content.

---

## 2026-05-25 (85) — Phase 3: Expenses module — PATCH /events/:id/expenses/:expenseId (edit expense)

**Files changed:**
- `apps/api/src/expenses/dto/update-expense.dto.ts` (**new**): all fields optional; `@ValidateIf` keeps `splits` required only when `splitType` is being set to `CUSTOM`.
- `apps/api/src/expenses/expenses.service.ts`: added `updateExpense()` — blocks edits on SETTLED/ARCHIVED events; guards: caller must be `paidBy` member (creator) or ORGANIZER; if any split-related field changes (`amount`, `splitType`, `memberIds`, `splits`), deletes old splits and creates new ones atomically in a transaction; falls back to existing split data when partial info is supplied (e.g. only `amount` changes on a CUSTOM expense reuses stored splits).
- `apps/api/src/expenses/expenses.controller.ts`: added `PATCH /events/:eventId/expenses/:expenseId` → 200.

---

## 2026-05-25 (84) — Phase 3: Expenses module — GET /events/:id/expenses (list non-deleted expenses)

**Files changed:**
- `apps/api/src/expenses/expenses.service.ts`: added `getExpenses()` — verifies caller is an ACTIVE member of the event, then returns all non-deleted expenses ordered by `createdAt DESC`, each including `paidBy` member info and `splits` with member nickname/userId.
- `apps/api/src/expenses/expenses.controller.ts`: added `GET /events/:eventId/expenses` → 200.

---

## 2026-05-25 (83) — Phase 3: Expenses module — POST /events/:id/expenses (create expense + splits)

**Files changed:**
- `apps/api/src/expenses/dto/create-expense.dto.ts` (**new**): `CreateExpenseDto` with `SplitItemDto` nested class. Validates `splitType` (EQUAL/CUSTOM), `paidById`, `amount` (integer ≥ 1), `description` (max 200), optional `category`, `receiptUrl`. For EQUAL mode accepts optional `memberIds` array; for CUSTOM mode requires `splits` array via `@ValidateIf`.
- `apps/api/src/expenses/expenses.service.ts` (**new**): `ExpensesService.createExpense()` — validates caller is ACTIVE member, validates `paidById` is an ACTIVE member, computes splits (EQUAL with remainder to first member per spec, CUSTOM with sum-check), creates expense + splits in a single Prisma transaction, returns full expense with paidBy and splits included.
- `apps/api/src/expenses/expenses.controller.ts` (**new**): `POST /events/:eventId/expenses` → 201.
- `apps/api/src/expenses/expenses.module.ts` (**new**): NestJS module wiring controller + service.
- `apps/api/src/app.module.ts`: registered `ExpensesModule`.

---

## 2026-05-25 (82) — Phase 3: Events module — integration tests for all Events endpoints (M2)

**Files changed:**
- `apps/api/test/events.e2e-spec.ts` (**new**): 43 integration tests against the live Neon DB via Supertest, following the same isolation strategy as `auth.e2e-spec.ts` (per-run `e2e-<timestamp>-` prefix; cleanup order: events before users due to `onDelete: Restrict` on `organizerId`).
  - `POST /events`: 201 happy path (with optional fields), 401, 400 missing/empty name
  - `GET /events`: returns only the caller's events, excludes soft-deleted events, 401
  - `GET /events/:id`: 200 for member, 403 for non-member, 404, 401
  - `PATCH /events/:id`: 200 organizer update, 403 non-organizer, 404, 401
  - `DELETE /events/:id`: 204 soft-delete (verifies `deletedAt` set in DB), 403, 404, 401
  - `GET /events/:id/invite`: 200 organizer, 403 non-organizer member, 401
  - `POST /events/:id/join`: 201 happy path, 409 already member, 400 wrong token, 400 ARCHIVED (status set directly via DB to avoid 404 from soft-delete), 401
  - `POST /events/:id/members`: 201 guest by name, guest `inviteToken` is null in response, 200 enumeration-safe for missing email, 201 creates PENDING member for verified user (verifies DB row), 409 already active, 403, 400 neither field, 401
  - `DELETE /events/:id/members/:memberId`: 204 soft-delete (verifies `removedAt` in DB), 400 target is ORGANIZER, 403, 404, 401

---

## 2026-05-25 (81) — Phase 3: Events module — unit tests for EventsService (M1)

**Files changed:**
- `apps/api/src/events/events.service.spec.ts` (**new**): 44 unit tests covering all public methods of `EventsService` with a mocked `PrismaService`. Tests follow the same `jest.fn()` + `mockPrisma` pattern established in `auth.service.spec.ts`.
  - `createEvent`: happy path (transaction creates event + organizer member), 404 when user doesn't exist
  - `getEvents`: returns correct query shape (filters by membership + `deletedAt: null`)
  - `getEventDetail`: happy path, 404 event not found, 403 caller not a member
  - `updateEvent`: happy path, 404, 403 non-organizer
  - `deleteEvent`: soft-delete (sets `deletedAt` + `status: ARCHIVED`), 404, 403
  - `joinEvent`: creates new member, restores removed member, 404/400 ARCHIVED/400 SETTLED/400 bad token/409 already active
  - `removeMember`: soft-delete, 404 event, 403 non-organizer, 400 SETTLED, 400 ARCHIVED, 404 member not found, 400 target is ORGANIZER
  - `addMember` (email): PENDING member created, invite token stripped from response, enumeration-safe 200 for missing/inactive/unverified users, 409 already active, 403, 400 ARCHIVED/SETTLED
  - `addMember` (guest): creates row with `userId: null`, 400 when neither email nor name provided
  - `acceptInvitation`: activates + clears token, 404 bad token, 403 wrong user, 409 already active, 400 expired, 400 event deleted, 400 SETTLED, 400 ARCHIVED

---

## 2026-05-25 (80) — Phase 3: Events missing feature — restrict GET /events/:id/invite to organizer (M5)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `getInvite`: replaced the membership check (`members: { where: { userId } }`) with an organizer check (`event.organizerId !== userId → 403`). The select now fetches `organizerId` instead of the members array. Non-organizer members calling `GET /events/:id/invite` now receive `403 Chỉ ban tổ chức mới có thể xem link mời`. Regular members can still join via the link after the organizer shares it out-of-band; they don't need API access to the token itself.

---

## 2026-05-25 (79) — Phase 3: Events missing feature — FK from Event.organizerId → User (M4)

**Files changed:**
- `apps/api/prisma/schema.prisma`:
  - `Event` model: added `organizer User @relation(fields: [organizerId], references: [id], onDelete: Restrict)`. `Restrict` prevents deleting a user who is the organizer of any event — the admin must archive/transfer the event first. Previously `organizerId` was a bare `String` with no DB-level enforcement, so deleting a user could silently orphan all their events.
  - `User` model: added `organizedEvents Event[]` (the inverse side of the relation, required by Prisma).
- `apps/api/prisma/migrations/20260525_add_event_organizer_fk/migration.sql` (**new**): `ALTER TABLE "events" ADD CONSTRAINT "events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`. Applied via `db push` (Neon pooler blocks shadow-DB creation) then recorded with `prisma migrate resolve --applied`.

---

## 2026-05-25 (78) — Phase 3: Events missing feature — PATCH /events/:id/invite regenerates public invite token (M3)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - Added `regenerateInviteToken(eventId, userId)`: verifies the caller is the organizer, then replaces `event.inviteToken` with a fresh `randomUUID()`. Returns `{ inviteToken, inviteUrl }` in the same shape as `getInvite`. The old token is immediately invalidated — any existing `/join/:oldToken` links stop working as soon as the DB is updated.
- `apps/api/src/events/events.controller.ts`:
  - Added `PATCH /events/:id/invite` → `regenerateInviteToken`. No request body needed.

---

## 2026-05-25 (77) — Phase 3: Events module security fix — addMember per-target invite rate limit (S3)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): added `joinedAt` to the `existing` member select. Before re-sending an invite to a PENDING member, checks whether `joinedAt` is within the last hour; if so, returns `{ ok: true }` silently instead of generating a new token and sending another email. The silent response preserves enumeration-safety — an organizer cannot distinguish "rate-limited" from "email not found" by inspecting the response. The 1-hour window is tracked via the existing `joinedAt` field (updated on every re-invite) so no schema change is needed.

---

## 2026-05-25 (76) — Phase 3: Events module security fix — addMember strips invite token from response (S2)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): destructures `inviteToken` and `inviteTokenExpiry` out of the Prisma result before returning, so neither field appears in the `201` response body. The token is only transmitted via the email sent to the invitee — exposing it in the API response would allow the organizer to accept the invite on behalf of the invitee or construct the acceptance URL without the invitee's involvement.

---

## 2026-05-25 (75) — Phase 3: Events module security fix — addMember fully enumeration-safe (S1)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): merged three separate early-return/throw branches into one: `if (!target || !target.isActive || !target.emailVerified) return { ok: true }`. Previously, a non-existent email returned `{ ok: true }` (correct) but a deactivated or unverified account threw a distinct `400` with a descriptive message — an attacker could probe any email address to learn whether it has an account and what its state is. All three cases now return the same silent `{ ok: true }` response, matching the pattern used in `forgotPassword`.

---

## 2026-05-25 (74) — Phase 3: Events module QA fix — addMember guest path blocks duplicate nicknames (M5)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (guest path): before creating the `EventMember` row, now queries for an existing active guest (`userId: null`) with the same `nickname` in the same event. Throws `409 Conflict` if found. The check filters `removedAt: null` so a previously removed guest with the same name can be re-added without conflict. Previously two rows with identical nicknames could be created, making their financial histories impossible to reconcile in the balance calculation.

---

## 2026-05-25 (73) — Phase 3: Events module QA fix — removeMember blocks SETTLED/ARCHIVED events (M4)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `removeMember`: expanded the `findFirst` select to include `status`, then added a guard that throws `400` when `event.status` is `SETTLED` or `ARCHIVED`. Previously, the organizer could soft-delete a member from a settled event, which would silently corrupt the historical balance — the removed member's past expenses would still exist but their membership would be gone, making the debt ledger inconsistent on re-calculation.

---

## 2026-05-25 (72) — Phase 3: Events module QA fix — unify invite URL format and add frontend pages (F5)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `sendEventInviteEmail`: changed email link URL from `/invitations/accept?token=${token}` to `/invitations/${token}/accept` — aligns with the new `POST /invitations/:token/accept` REST route (path param, not query param), matching the NestJS controller convention used throughout the codebase.
  - Added `resolveEventByInviteToken(token)` — public method that looks up an event by its `inviteToken` and returns the preview fields (`id`, `name`, `type`, `description`, `status`). Used by the join page before the user authenticates.
  - Added `joinByEventToken(token, userId)` — resolves the eventId from the event-level invite token, then delegates to the existing `joinEvent` method.
  - Added `acceptInvitationByMemberToken(token, userId)` — resolves the eventId from the member-level `inviteToken` on `EventMember`, then delegates to the existing `acceptInvitation` method.
- `apps/api/src/events/join.controller.ts` (**new**): `@Controller('join')` — `GET /:token` (public, event preview), `POST /:token` (authenticated, join event).
- `apps/api/src/events/invitations.controller.ts` (**new**): `@Controller('invitations')` — `POST /:token/accept` (authenticated, accept email invite).
- `apps/api/src/events/events.module.ts`: registered `JoinController` and `InvitationsController`.
- `apps/web/app/join/[token]/page.tsx` (**new**): public join page — shows event name/type/description and a "Tham gia sự kiện" CTA that routes through login with a redirect back to the join URL.
- `apps/web/app/invitations/[token]/accept/page.tsx` (**new**): invitation acceptance page — shows event name and an "Chấp nhận lời mời" button (wired to `POST /invitations/:token/accept` in Phase 4).

---

## 2026-05-25 (71) — Phase 3: Events module QA fix — EVENT_LIST_SELECT counts only active non-removed members (F4)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `EVENT_LIST_SELECT`: replaced `_count: { select: { members: true } }` with `_count: { select: { members: { where: { status: MemberStatus.ACTIVE, removedAt: null } } } }`. Previously the count included PENDING members (invited but not yet accepted) and soft-deleted members (removedAt not null), so the dashboard card would show an inflated member count. Now only members who are fully active and not removed are counted, matching the visible membership shown in the event detail view.

---

## 2026-05-25 (70) — Phase 3: Events module QA fix — acceptInvitation guards deleted and terminal-status events (F3)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `acceptInvitation`: expanded the `findFirst` select to include `event: { select: { deletedAt, status } }` so the parent event is fetched in a single query. Added two guards before the ownership check: (1) throws `400` if `event.deletedAt !== null` — prevents activating a member on a soft-deleted event; (2) throws `400` if `event.status` is `SETTLED` or `ARCHIVED` — prevents accepting an invitation to a terminal-state event. Previously a user could accept an email invite after the event had been deleted or settled, creating an active membership that would never appear in any query (deleted events are filtered out of all list/detail views) or that would corrupt settled balances.

---

## 2026-05-25 (69) — Phase 3: Events module QA fix — addMember blocks SETTLED events (F2)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember`: expanded the status guard from `ARCHIVED`-only to `ARCHIVED || SETTLED`. Error message updated to the generic "Không thể thêm thành viên vào sự kiện đã kết thúc" (covers both terminal states). Previously, the organizer could add members (email or guest path) to a SETTLED event, which would introduce new participants after balances had already been calculated and confirmed, corrupting the debt ledger. The fix mirrors the same guard already applied in `joinEvent` (entry 66).

---

## 2026-05-25 (68) — Phase 3: Events module QA fix — joinEvent restores member with status ACTIVE (F1)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `joinEvent` (restore path): added `status: MemberStatus.ACTIVE`, `inviteToken: null`, `inviteTokenExpiry: null` to the `update` data when restoring a previously removed member. Previously only `removedAt` and `joinedAt` were reset, leaving the member in `PENDING` status if they had been invited via email before being removed. A PENDING member is filtered out by `getEvents`, `getEventDetail`, and `getInvite`, effectively locking them out of the event despite holding a valid session. Clearing the invite token fields also invalidates any stale email invitation after a public-link rejoin.

---

## 2026-05-25 (67) — Phase 3: Events module security fix — addMember enumeration-safe for unknown email (S3)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): replaced `throw new NotFoundException(…)` when `target` is null with a silent `return { ok: true }`. The caller (organizer) receives a 201 response in both cases — found-and-invited and not-found — so the HTTP status code cannot be used to enumerate which emails have registered accounts. Pattern matches `forgotPassword()` which already uses the same enumeration-safe approach.

---

## 2026-05-25 (66) — Phase 3: Events module QA fix — joinEvent blocks SETTLED events (F4)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `joinEvent`: expanded the status guard from `ARCHIVED`-only to `ARCHIVED || SETTLED`. Error message updated to the generic "Sự kiện đã kết thúc, không thể tham gia" (covers both terminal states). Previously a user could join a fully-settled event via invite link, which would corrupt balances by introducing a new member with zero history after settlement was calculated.

---

## 2026-05-25 (65) — Phase 3: Events module QA fix — addMember validates isActive & emailVerified (F3)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): expanded `user.findUnique` select to include `isActive` and `emailVerified`; throws `400 BadRequestException` ("Tài khoản người dùng này đã bị vô hiệu hoá") if `isActive` is false; throws `400 BadRequestException` ("Người dùng này chưa xác minh email…") if `emailVerified` is false. Both checks run after the 404 guard and before the existing-membership check, so deactivated/unverified users cannot be added even via re-invite.

---

## 2026-05-25 (64) — Phase 3: Events module QA fix — addMember invite accept flow (F5)

**Files changed:**
- `apps/api/prisma/schema.prisma` — thêm enum `MemberStatus { PENDING ACTIVE }` và 3 field vào `EventMember`: `status MemberStatus @default(ACTIVE)`, `inviteToken String? @unique`, `inviteTokenExpiry DateTime?`
- `apps/api/prisma/migrations/20260525_add_member_status_and_invite_token/migration.sql` — tạo enum + alter table + unique index
- `apps/api/src/events/events.service.ts`:
  - `addMember` (email path): tạo member với `status: PENDING` + generate `inviteToken` (UUID) và `inviteTokenExpiry` (48h); email chứa link accept thay vì link event trực tiếp; re-invite member bị remove hoặc PENDING cũng reset token
  - `acceptInvitation`: method mới — tìm member theo `inviteToken`, kiểm tra ownership + expiry, cập nhật `status → ACTIVE`, xóa token
  - `getEvents`: filter `status: ACTIVE` khi kiểm tra membership → PENDING member không thấy event trong dashboard
  - `getEventDetail`: filter `status: ACTIVE` trong danh sách member + access check
  - `getInvite`: filter `status: ACTIVE`
  - `joinEvent`: filter `status: ACTIVE` khi check existing membership
- `apps/api/src/events/events.controller.ts` — thêm `POST /events/:id/invitations/:token/accept`

---

## 2026-05-25 (63) — Phase 3: Events module QA fix — addMember invite email (F2)

**Files changed:**
- `apps/api/src/events/events.service.ts`:
  - Added `escapeHtml` helper and `Logger` (matching auth service pattern)
  - `addMember` (email path): expanded event query to also fetch `name` and `inviteToken`; fetched organizer name in parallel via `Promise.all`; after creating/restoring the EventMember, fires `sendEventInviteEmail` as a non-blocking background call (`void`)
  - Added `sendEventInviteEmail` private method: sends an HTML email via Resend notifying the user which organizer added them and linking to the event; falls back to `logger.log` in dev when `RESEND_API_KEY` is absent

---

## 2026-05-25 (62) — Phase 3: Events module QA fix — removeMember soft-delete (F1)

**Files changed:**
- `apps/api/prisma/schema.prisma` — added `removedAt DateTime?` field to `EventMember`
- `apps/api/prisma/migrations/20260525_add_removed_at_to_event_members/migration.sql` — new migration
- `apps/api/src/events/events.service.ts`:
  - `removeMember`: removed 409 financial-history block; now soft-deletes by setting `removedAt = now()` instead of hard-deleting — preserves all expense/settlement history per spec §5.2
  - `getEventDetail`: member list filtered to `removedAt: null`; active-membership check via join query updated accordingly
  - `joinEvent`: active-membership check filters `removedAt: null`; removed members who rejoin via invite link have their row restored (removedAt reset) rather than a new row created
  - `addMember` (email path): checks `removedAt` before throwing 409; restores previously removed members instead of erroring

---

## 2026-05-25 (61) — Phase 3: Events module — DELETE /events/:id/members/:memberId

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `removeMember(eventId, callerId, memberId)` — 404 if event not found/deleted; 403 if caller is not the organizer; 404 if the target member row doesn't exist in this event; 400 if target has `role: ORGANIZER` (organizer cannot be removed); 409 if the member has any financial history (`paidExpenses`, `expenseSplits`, `sentSettlements`, or `receivedSettlements` counts > 0). On success, hard-deletes the `EventMember` row. Returns void; controller sends 204.
- `apps/api/src/events/events.controller.ts`: Added `DELETE /events/:id/members/:memberId` handler returning 204 No Content.

---

## 2026-05-25 (60) — Phase 3: Events module — POST /events/:id/members

**Files added:**
- `apps/api/src/events/dto/add-member.dto.ts`: `AddMemberDto` with optional `email` (validated as email format) and `name` (max 100 chars, required via `@ValidateIf` when `email` is absent). Service also guards against both fields being missing.

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `addMember(eventId, callerId, dto)` — 404 if event not found/deleted; 403 if caller is not the organizer; 400 if event is ARCHIVED. **Email path**: looks up user by email (404 if not found), checks for existing membership (409 if duplicate), creates `EventMember` with the user's id and name. **Guest path**: creates `EventMember` with `userId: null` and the provided `name` as nickname; multiple guests allowed because PostgreSQL's unique constraint treats NULL ≠ NULL.
- `apps/api/src/events/events.controller.ts`: Added `POST /events/:id/members` handler returning 201 Created.

---

## 2026-05-25 (59) — Phase 3: Events module — POST /events/:id/join

**Files added:**
- `apps/api/src/events/dto/join-event.dto.ts`: `JoinEventDto` with a required `token` string field (`@IsString @IsNotEmpty`).

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `joinEvent(eventId, userId, dto)` — fetches event by id (404 if not found or deleted); 400 if event is ARCHIVED; 400 if provided token doesn't match `event.inviteToken`; 409 if user already has a member row for this event. On success, looks up the user's name and creates an `EventMember` row with role `MEMBER`. Returns the new member record.
- `apps/api/src/events/events.controller.ts`: Added `POST /events/:id/join` handler returning 201 Created.

---

## 2026-05-25 (58) — Phase 3: Events module — GET /events/:id/invite

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `getInvite(eventId, userId)` — fetches `inviteToken` and checks if the caller has a member row in the event in a single query (404 if not found/deleted; 403 if caller is not a member). Returns `{ inviteToken, inviteUrl }` where `inviteUrl` is constructed from `NEXT_PUBLIC_APP_URL` env var (falls back to `http://localhost:3000`).
- `apps/api/src/events/events.controller.ts`: Added `GET /events/:id/invite` handler returning 200. Placed before `GET /events/:id` in the route list to prevent `:id` from swallowing the `invite` segment.

---

## 2026-05-25 (57) — Phase 3: Events module — DELETE /events/:id

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `deleteEvent(eventId, userId)` — fetches `organizerId` (404 if not found or already deleted); throws 403 if caller is not the organizer; sets `deletedAt = now()` and `status = ARCHIVED` (soft delete). Returns void; controller sends 204.
- `apps/api/src/events/events.controller.ts`: Added `DELETE /events/:id` handler returning 204 No Content.

---

## 2026-05-25 (56) — Phase 3: Events module — PATCH /events/:id

**Files added:**
- `apps/api/src/events/dto/update-event.dto.ts`: All fields optional — `name` (`@MinLength(1) @MaxLength(100)`), `type` (`@IsEnum(EventType)`), `description` (`@MaxLength(500)`), `coverImageUrl` (`@IsUrl`).

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `updateEvent(eventId, userId, dto)` — fetches `organizerId` (404 if not found or deleted); throws 403 if caller is not the organizer; patches only the fields present in the DTO using conditional spread.
- `apps/api/src/events/events.controller.ts`: Added `PATCH /events/:id` handler returning 200.

---

## 2026-05-25 (55) — Phase 3: Events module — GET /events/:id

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `getEventDetail(eventId, userId)` — fetches the event by ID where `deletedAt` is null (404 if not found); includes `members` ordered by role then join date; throws 403 if the caller is not in the members list.
- `apps/api/src/events/events.controller.ts`: Added `GET /events/:id` handler returning 200.

---

## 2026-05-25 (54) — Phase 3: Events module — GET /events

**Files changed:**
- `apps/api/src/events/events.service.ts`: Added `EVENT_LIST_SELECT` constant (id, name, description, type, status, coverImageUrl, organizerId, createdAt, updatedAt, `_count.members`). Added `getEvents(userId)` — queries events where `deletedAt` is null and the user is a member (`members.some({ userId })`), ordered by `createdAt desc`.
- `apps/api/src/events/events.controller.ts`: Added `GET /events` handler returning 200, delegating to `eventsService.getEvents`.

---

## 2026-05-25 (53) — Phase 3: Events module — POST /events

**Files added:**
- `apps/api/src/events/dto/create-event.dto.ts`: `CreateEventDto` with `name` (`@IsString @IsNotEmpty @MaxLength(100)`), optional `type` (`@IsEnum(EventType)`), optional `description` (`@IsString @MaxLength(500)`), and optional `coverImageUrl` (`@IsUrl`).
- `apps/api/src/events/events.service.ts`: `EventsService` with `createEvent(userId, dto)` — fetches the user's `name` from DB (throws 404 if not found), then runs a `$transaction` that (1) creates the `Event` row with `organizerId` set to the caller and (2) creates an `EventMember` row linking the user as `ORGANIZER`. Returns the event object with the `members` array.
- `apps/api/src/events/events.controller.ts`: `EventsController` at path `events`. `POST /events` is protected by the global `JwtAuthGuard`, uses `@CurrentUser()` to extract the user ID, returns 201.
- `apps/api/src/events/events.module.ts`: NestJS module wiring `EventsController` and `EventsService`.

**Files changed:**
- `apps/api/src/app.module.ts`: Added `EventsModule` to the `imports` array.

---

## 2026-05-25 (52) — Phase 3: Users module — GET /users/me + PATCH /users/me

**Files added:**
- `apps/api/src/users/dto/update-profile.dto.ts`: `UpdateProfileDto` with optional `name` (`@IsString @MinLength(1) @MaxLength(100)`) and `avatarUrl` (`@IsUrl`) fields. Both are fully optional so callers can patch just one field at a time.
- `apps/api/src/users/users.service.ts`: `UsersService` with two methods:
  - `getMe(userId)` — fetches `id`, `email`, `name`, `avatarUrl`, `role`, `emailVerified`, `createdAt` for the authenticated user; throws 404 if the user no longer exists.
  - `updateMe(userId, dto)` — verifies the user exists (404 if not), then updates only the fields present in the DTO using conditional spread to avoid overwriting unset fields with `undefined`; returns the same safe field set.
- `apps/api/src/users/users.controller.ts`: `UsersController` at path `users`, protected by the global `JwtAuthGuard`. Uses `@CurrentUser()` to extract the JWT payload (`sub` = user ID) for both handlers.
  - `GET /users/me` → delegates to `usersService.getMe`.
  - `PATCH /users/me` → delegates to `usersService.updateMe`.
- `apps/api/src/users/users.module.ts`: NestJS module wiring `UsersController` and `UsersService`. `PrismaModule` is global so no explicit import needed.

**Files changed:**
- `apps/api/src/app.module.ts`: Added `UsersModule` to the `imports` array.

---

## 2026-05-25 (51) — Phase 3: Auth — Integration tests with Supertest + Neon DB (M10)

**Files added:**
- `apps/api/test/auth.e2e-spec.ts`: 33 integration tests across 7 describe blocks covering all auth endpoints. Runs against the `DATABASE_URL` from `.env` (Neon PostgreSQL — no Docker needed). Isolation: every email is prefixed with a unique per-run stamp (`e2e-<timestamp>-`); stale rows from prior runs are deleted in `beforeAll`, and all rows created in this run are deleted in `afterAll`. `ThrottlerGuard.prototype.canActivate` is spied on before module compilation to prevent 429s during rapid test execution.
  - `POST /auth/register` (7 cases): happy path, DB persistence, duplicate email, missing/empty name, invalid email, short password.
  - `POST /auth/login` (6 cases): HttpOnly cookies on success, safe body, wrong password, unknown email, unverified email, inactive user.
  - `POST /auth/refresh` (3 cases): valid token → new cookies, no cookie → 401, token absent from DB → 401.
  - `POST /auth/logout` (3 cases): cookies cleared, ok without cookie, refresh token deleted from DB.
  - `POST /auth/verify-email` (5 cases): marks verified + clears token, idempotent for already-verified, unknown token, expired token, user can log in after verification.
  - `POST /auth/forgot-password` (4 cases): always ok (enumeration-safe), reset token persisted for verified user, no token for unverified user, missing field → 400.
  - `POST /auth/reset-password` (5 cases): password changed (old rejected, new accepted), unknown token, expired token, short password, token is single-use.
- `apps/api/test/jest-e2e.json`: Jest config for e2e suite (`tsconfig.e2e.json`, `test/*.e2e-spec.ts`, 120 s timeout).
- `apps/api/tsconfig.e2e.json`: TypeScript config extending the base with `esModuleInterop: true` and `include: ["src/**/*", "test/**/*"]`.

**Files changed:**
- `apps/api/package.json`: Added `test:e2e` script; added `supertest` + `@types/supertest` devDependencies.
- `apps/api/tsconfig.json`: Added `test/**/*` to `include` so IDE diagnostics work for e2e files (production build still excluded via `tsconfig.build.json`).

---

## 2026-05-25 (50) — Phase 3: Auth — Unit test gaps closed (M5, M6)

**Files changed:**
- `apps/api/src/auth/auth.service.spec.ts`: Added 3 missing unit tests to the `refresh` describe block:
  - `throws 401 when refresh token is expired (correct secret, exp in past)` (M5) — signs a JWT with `exp` set 60 s in the past; `verify()` throws `TokenExpiredError`, caught and rethrown as 401.
  - `throws 401 when user is inactive` (M6) — valid token, user returned with `isActive: false`; guard rejects before reaching the refreshToken DB check.
  - `throws 401 when user email is not verified` (M6) — valid token, user returned with `emailVerified: false`; same guard path.
- Total tests: 32 → 35, all passing.

**Also:** Marked M4, M5, M6, and M9 as `[x]` in `specs/implementation-plan.md` — M4 was already covered by the F1 test, M9 was done in entry 49 but the checkbox was not updated.

---

## 2026-05-25 (49) — Phase 3: Auth — Stricter rate limiting on login & forgot-password (M9)

**Files changed:**
- `apps/api/src/app.module.ts`: Added `ThrottlerGuard` as the first `APP_GUARD` (applied before JWT and role guards). Named the existing throttler `'default'` to support per-endpoint overrides. Global limit remains 60 req/min per IP.
- `apps/api/src/auth/auth.controller.ts`: Imported `Throttle` from `@nestjs/throttler`. Added `@Throttle({ default: { ttl: 60_000, limit: 5 } })` to `POST /auth/login` and `POST /auth/forgot-password`, overriding the global default to 5 req/min for those two endpoints only.

**Note:** The `ThrottlerGuard` was not previously registered as a global guard, so the 60 req/min bucket was defined but never enforced. This change activates global rate limiting for the first time.

---

## 2026-05-25 (48) — Phase 3: Auth — Refresh token rotation with DB invalidation (M3)

**Files changed:**
- `apps/api/prisma/schema.prisma`: Added `RefreshToken` model (`id`, `userId`, `tokenHash` (unique), `expiresAt`, `createdAt`) with a cascade-delete relation to `User` and an index on `userId`.
- `apps/api/prisma/migrations/20260525_add_refresh_token_table/migration.sql`: Migration SQL creating the `refresh_tokens` table, unique index on `tokenHash`, and FK to `users` with `ON DELETE CASCADE`.
- `apps/api/src/auth/auth.service.ts`:
  - Added `hashToken(token)` — SHA-256 hex digest of the raw JWT (deterministic, fast, no salt needed for lookup).
  - Added `storeRefreshToken(userId, token)` — hashes and persists the token with a 7-day expiry.
  - Added `rotateRefreshToken(oldToken, userId, newToken)` — atomically deletes the old hash and inserts the new one in a `$transaction`.
  - `login()`: calls `storeRefreshToken()` after issuing tokens.
  - `googleLogin()`: calls `storeRefreshToken()` after issuing tokens.
  - `refresh()`: validates the incoming token against the DB; throws 401 if not found or expired; calls `rotateRefreshToken()` to blacklist old and register new token atomically.
  - `logout()`: now accepts `req`, extracts the refresh token cookie, and calls `deleteMany` on its hash before clearing cookies.
- `apps/api/src/auth/auth.controller.ts`: `logout` handler updated to inject `@Req()` and pass it to `authService.logout(req, res)`.
- `apps/api/src/auth/auth.service.spec.ts`: Updated `mockPrisma` to include `refreshToken` (create/findUnique/delete/deleteMany) and `$transaction`. Fixed `logout` test (now async, passes mock `req`). Added second logout test for missing cookie. Updated `refresh` happy-path test to mock `refreshToken.findUnique/delete/create`.

---

## 2026-05-25 (47b) — Phase 3: Auth — resendVerification unit tests

**Files changed:**
- `apps/api/src/auth/auth.service.spec.ts`: Added `describe('resendVerification')` block with 4 unit tests matching the pattern used for `forgotPassword`: happy path (token generated, 24 h expiry verified), unknown email, inactive user, and already-verified user — all silent `{ ok: true }` without touching DB. Suite grows from 27 → 31 tests, all passing.

---

## 2026-05-25 (47) — Phase 3: Auth — POST /auth/resend-verification (M2)

**Files changed:**
- `apps/api/src/auth/dto/resend-verification.dto.ts`: New DTO with `@IsEmail()` on the `email` field.
- `apps/api/src/auth/auth.service.ts`: Added `resendVerification(dto)`. Looks up user by email; silently returns `{ ok: true }` if the user doesn't exist, is inactive, or is already verified (enumeration-safe). Otherwise generates a fresh UUID token with a 24 h expiry, updates the DB, and calls `sendVerificationEmail()`.
- `apps/api/src/auth/auth.controller.ts`: Added `POST /auth/resend-verification` (public, `200 OK`), delegating to `authService.resendVerification()`.

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
