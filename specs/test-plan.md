# Test Plan — Titra

**Version:** 0.1
**Last updated:** 2026-05-24

---

## Testing Philosophy

- Test behavior, not implementation. Tests should survive internal refactors.
- Financial calculation logic (balances, splits) gets the most test coverage — bugs here directly harm users.
- Integration tests (real DB, real HTTP) are preferred over heavy mocking for API tests.
- E2E tests cover critical user journeys only; they are slow and fragile.

---

## Test Layers

| Layer          | Tool                    | Location                  | Run on       |
|----------------|-------------------------|---------------------------|--------------|
| Unit           | Vitest                  | `apps/api/src/**/*.spec.ts` | Every push |
| Unit           | Vitest                  | `packages/shared/**/*.spec.ts` | Every push |
| Integration    | Vitest + Supertest + testcontainers | `apps/api/test/*.e2e-spec.ts` | Every PR |
| Component      | Vitest + React Testing Library | `apps/web/**/*.spec.tsx` | Every push |
| E2E            | Playwright              | `apps/web/e2e/`           | Pre-merge to main |

---

## Unit Tests

### packages/shared — Zod schemas
- All valid shapes pass validation.
- Required fields missing → schema throws.
- Negative amounts rejected.
- Amount > MAX_INT rejected.

### apps/api — Balance Calculation Service
| Test case | Expected |
|-----------|----------|
| Single payer, equal split among 3 | Each of 2 non-payers owes payer 1/3 of amount |
| Two payers, unequal amounts | Net balances correctly computed |
| All members paid equal amounts | Zero balances for everyone |
| Custom split amounts don't sum to total | Service throws validation error |
| Equal split with rounding (amount not divisible by n) | Remainder goes to first member; total equals original |
| Confirmed settlement reduces debt | Settlement amount subtracted from debtor balance |
| Multiple settlements, partially paid | Remaining balance correctly reduced |
| Debt simplification: 3-way cycle (A→B, B→C, C→A) | Simplified to 0 or minimum transactions |
| Group of 10 members, 50 expenses | Correct net zero (sum of all balances = 0) |

### apps/api — Auth Service
| Test case | Expected |
|-----------|----------|
| Register with valid data | User created, verification email queued |
| Register with duplicate email | 409 Conflict |
| Login with correct credentials | Returns access + refresh tokens |
| Login with wrong password | 401 Unauthorized |
| Refresh with valid refresh token | New access token issued |
| Refresh with expired token | 401 Unauthorized |
| Access protected route without token | 401 Unauthorized |
| Access organizer route as member | 403 Forbidden |
| Access admin route as organizer | 403 Forbidden |

### apps/api — Expense Service
| Test case | Expected |
|-----------|----------|
| Create expense with equal split | ExpenseSplit rows created correctly |
| Create expense with custom split | Amounts stored as provided |
| Custom split doesn't sum to total | 400 Bad Request |
| Delete expense (soft delete) | `deletedAt` set; excluded from balance calc |
| Non-member tries to create expense | 403 Forbidden |

---

## Integration Tests (API)

Use a real PostgreSQL instance via testcontainers (Docker). Each test suite seeds its own data and rolls back after.

### Auth endpoints
- `POST /api/v1/auth/register` — happy path and error cases
- `POST /api/v1/auth/login` — happy path and error cases
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### Events endpoints
- `POST /api/v1/events` — create event
- `GET /api/v1/events` — list user's events
- `GET /api/v1/events/:id` — get event (member-only access)
- `PATCH /api/v1/events/:id` — organizer can update, member cannot
- `DELETE /api/v1/events/:id` — organizer can archive, member cannot

### Members endpoints
- `GET /api/v1/events/:id/invite` — generate invite link
- `POST /api/v1/events/:id/join` — join via token
- `DELETE /api/v1/events/:id/members/:memberId` — organizer can remove member

### Expenses endpoints
- Full CRUD integration test
- Balance endpoint returns correct simplified transactions after adding expenses

### Settlements endpoints
- Create settlement → status PENDING
- Confirm settlement (by recipient) → status CONFIRMED; balance updated
- Confirm by non-recipient → 403

---

## Component Tests (Frontend)

Use React Testing Library + Vitest.

### ExpenseForm
- Renders all required fields
- Equal split mode: shows member checkboxes, calculates per-person share dynamically
- Custom split mode: shows amount inputs per member, shows error if sum ≠ total
- Submit with missing description → shows validation error
- Submit with amount = 0 → shows validation error

### BalanceView
- Renders "Everyone is settled up" when all balances are zero
- Renders correct creditor/debtor pairs
- Amounts formatted in VND (e.g., "150.000 ₫")

### SettlementDialog
- Payment method selector renders MoMo and VNPay options
- MoMo deep-link generated with correct amount
- Proof upload input appears after method selected

### InviteLink
- Copy button copies link to clipboard
- Regenerate button calls API and updates displayed link

---

## E2E Tests (Playwright)

Covers the full happy path for MVP's core flows.

### Flow 1: Create event and invite a friend
1. User A registers and logs in.
2. Creates event "Đà Lạt trip".
3. Copies invite link.
4. User B registers via invite link.
5. Both see each other in the members list.

### Flow 2: Log an expense and view balances
1. (Continuing Flow 1) User A logs expense: 300,000 VND "Ăn tối", paid by A, split equally.
2. Balance page shows: User B owes User A 150,000 VND.
3. User B logs expense: 200,000 VND "Xăng xe", paid by B, split equally.
4. Balance page shows: User B owes User A 50,000 VND.

### Flow 3: Settle a debt
1. User B records settlement: pays User A 50,000 VND via MoMo.
2. Status shows PENDING.
3. User A confirms settlement.
4. Balance page shows: Everyone settled up.

### Flow 4: Export PDF
1. Organizer (User A) clicks Export PDF.
2. PDF downloads and contains expense list and settlement history.

### Flow 5: Admin dashboard access control
1. Regular user navigates to `/admin` → redirected to dashboard.
2. Admin user navigates to `/admin` → admin dashboard renders.

---

## Coverage Targets

| Area                          | Target |
|-------------------------------|--------|
| Balance calculation service   | 100%   |
| Auth service                  | 90%    |
| All other API services        | 80%    |
| Shared Zod schemas            | 100%   |
| Frontend components (RTL)     | 70%    |
| E2E happy paths               | 5 flows covered |

---

## CI Pipeline

```yaml
# On every push
- pnpm lint
- pnpm typecheck
- pnpm test:unit          # Vitest unit tests

# On every PR
- All above
- pnpm test:integration   # Supertest + testcontainers

# On merge to main
- All above
- pnpm test:e2e           # Playwright against preview deployment
```
