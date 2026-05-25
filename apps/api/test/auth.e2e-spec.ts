/**
 * Auth integration tests — run against the DATABASE_URL in .env (no Docker needed).
 * Run with: pnpm test:e2e
 *
 * Isolation strategy: every email used in this suite is prefixed with a
 * per-run stamp (e2e-<timestamp>-). beforeAll deletes any leftover rows from
 * previous runs; afterAll deletes all rows created in this run.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Per-run email prefix ─────────────────────────────────────────────────────

const RUN_ID = `e2e-${Date.now()}`;

/** Stamp a local-part so emails are unique per test run. */
function email(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

// ─── App setup ────────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  // Ensure JWT secrets are set for the test process
  process.env['JWT_SECRET'] ??= 'e2e-jwt-secret-32chars-minimum!!';
  process.env['JWT_REFRESH_SECRET'] ??= 'e2e-refresh-secret-32chars-min!!';

  // ThrottlerGuard is bound to the APP_GUARD token, not its own class token,
  // so overrideProvider/overrideGuard don't intercept it. Mocking the prototype
  // before module compilation is the only reliable way to disable throttling.
  jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.init();

  prisma = moduleFixture.get(PrismaService);

  // Remove any stale rows from a previous interrupted run
  await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
}, 30_000);

afterAll(async () => {
  // Clean up all rows created by this run
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerUser(payload: Record<string, string>) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(payload);
}

/**
 * Register + directly set emailVerified so the user can log in.
 * Returns the full DB row.
 */
async function registerAndVerify(local: string, password = 'password123') {
  const addr = email(local);
  await registerUser({ name: 'Test User', email: addr, password });
  const user = await prisma.user.findUnique({ where: { email: addr } });
  if (!user) throw new Error(`user not found after register: ${addr}`);
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return user;
}

async function loginUser(local: string, password = 'password123') {
  return request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: email(local), password });
}

function getCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as string | string[] | undefined;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('201 — creates user and returns safe fields', async () => {
    const res = await registerUser({ name: 'An Nguyen', email: email('reg-ok'), password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: email('reg-ok'), name: 'An Nguyen', emailVerified: false });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('verificationToken');
  });

  it('201 — password is hashed and token is persisted in DB', async () => {
    await registerUser({ name: 'Binh Le', email: email('reg-db'), password: 'password123' });

    const user = await prisma.user.findUnique({ where: { email: email('reg-db') } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe('password123');
    expect(user!.verificationToken).not.toBeNull();
    expect(user!.verificationTokenExpiry).not.toBeNull();
  });

  it('409 — duplicate email', async () => {
    await registerUser({ name: 'First', email: email('reg-dup'), password: 'password123' });
    const res = await registerUser({ name: 'Second', email: email('reg-dup'), password: 'password456' });

    expect(res.status).toBe(409);
  });

  it('400 — missing name', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: email('reg-noname'), password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('400 — empty name', async () => {
    const res = await registerUser({ name: '', email: email('reg-emptyname'), password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('400 — invalid email', async () => {
    const res = await registerUser({ name: 'Test', email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('400 — password shorter than 8 chars', async () => {
    const res = await registerUser({ name: 'Test', email: email('reg-shortpw'), password: 'abc' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('200 — sets HttpOnly access and refresh cookies on correct credentials', async () => {
    await registerAndVerify('login-ok');

    const res = await loginUser('login-ok');

    expect(res.status).toBe(200);
    const cookies = getCookies(res);
    expect(cookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some(c => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some(c => c.toLowerCase().includes('httponly'))).toBe(true);
  });

  it('200 — response body contains safe user fields only', async () => {
    await registerAndVerify('login-fields');

    const res = await loginUser('login-fields');

    expect(res.body).toMatchObject({ email: email('login-fields'), emailVerified: true });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('401 — wrong password', async () => {
    await registerAndVerify('login-wrongpw');

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email('login-wrongpw'), password: 'WRONGPASSWORD' });
    expect(res.status).toBe(401);
  });

  it('401 — non-existent email', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email('login-nobody'), password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('401 — unverified email cannot log in', async () => {
    await registerUser({ name: 'Unverified', email: email('login-unverified'), password: 'password123' });

    const res = await loginUser('login-unverified');
    expect(res.status).toBe(401);
  });

  it('401 — inactive user cannot log in', async () => {
    await registerAndVerify('login-inactive');
    await prisma.user.update({
      where: { email: email('login-inactive') },
      data: { isActive: false },
    });

    const res = await loginUser('login-inactive');
    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('200 — issues new access and refresh cookies with a valid refresh token', async () => {
    await registerAndVerify('refresh-ok');
    const loginRes = await loginUser('refresh-ok');
    const loginCookies = getCookies(loginRes);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookies);

    expect(res.status).toBe(200);
    const refreshedCookies = getCookies(res);
    expect(refreshedCookies.some(c => c.startsWith('access_token='))).toBe(true);
    expect(refreshedCookies.some(c => c.startsWith('refresh_token='))).toBe(true);
  });

  it('401 — no refresh token cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('401 — refresh token not present in DB (simulates post-logout state)', async () => {
    await registerAndVerify('refresh-db');
    const loginRes = await loginUser('refresh-db');
    const loginCookies = getCookies(loginRes);

    // Delete the stored token — same effect as calling /logout
    const user = await prisma.user.findUnique({ where: { email: email('refresh-db') } });
    await prisma.refreshToken.deleteMany({ where: { userId: user!.id } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookies);
    expect(res.status).toBe(401);
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('200 — clears cookies', async () => {
    await registerAndVerify('logout-ok');
    const loginRes = await loginUser('logout-ok');
    const loginCookies = getCookies(loginRes);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', loginCookies);

    expect(res.status).toBe(200);
    const logoutCookies = getCookies(res);
    expect(
      logoutCookies.some(c => c.includes('access_token=;') || c.includes('Max-Age=0')),
    ).toBe(true);
  });

  it('200 — ok without any cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
  });

  it('refresh token is deleted from DB after logout', async () => {
    await registerAndVerify('logout-invalidate');
    const loginRes = await loginUser('logout-invalidate');
    const loginCookies = getCookies(loginRes);

    const user = await prisma.user.findUnique({ where: { email: email('logout-invalidate') } });
    const before = await prisma.refreshToken.count({ where: { userId: user!.id } });
    expect(before).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', loginCookies);

    const after = await prisma.refreshToken.count({ where: { userId: user!.id } });
    expect(after).toBe(0);
  });
});

// ─── POST /auth/verify-email ──────────────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  it('200 — valid token marks emailVerified and clears the token', async () => {
    await registerUser({ name: 'Verify Me', email: email('verify-ok'), password: 'password123' });
    const user = await prisma.user.findUnique({ where: { email: email('verify-ok') } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: user!.verificationToken });

    expect(res.status).toBe(200);
    const updated = await prisma.user.findUnique({ where: { email: email('verify-ok') } });
    expect(updated!.emailVerified).toBe(true);
    expect(updated!.verificationToken).toBeNull();
  });

  it('200 — idempotent: token belonging to an already-verified user returns ok', async () => {
    // registerAndVerify sets emailVerified=true without clearing the token,
    // which is the edge case the service handles with an early return.
    const user = await registerAndVerify('verify-idem');
    expect(user.verificationToken).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: user.verificationToken });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('400 — unknown token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: 'completely-invalid-token' });
    expect(res.status).toBe(400);
  });

  it('400 — expired token', async () => {
    await registerUser({ name: 'Expired', email: email('verify-expired'), password: 'password123' });
    const user = await prisma.user.findUnique({ where: { email: email('verify-expired') } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { verificationTokenExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: user!.verificationToken });
    expect(res.status).toBe(400);
  });

  it('user can log in after verifying email', async () => {
    await registerUser({ name: 'Login After Verify', email: email('verify-login'), password: 'password123' });
    const user = await prisma.user.findUnique({ where: { email: email('verify-login') } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: user!.verificationToken });

    const loginRes = await loginUser('verify-login');
    expect(loginRes.status).toBe(200);
  });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  it('200 — always ok, even for unknown email (prevents enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('fp-nobody') });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('200 — known verified user receives a reset token in DB', async () => {
    await registerAndVerify('fp-ok');

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('fp-ok') });

    const user = await prisma.user.findUnique({ where: { email: email('fp-ok') } });
    expect(user!.passwordResetToken).not.toBeNull();
    expect(user!.passwordResetExpiry!.getTime()).toBeGreaterThan(Date.now());
  });

  it('200 — unverified user does not receive a reset token', async () => {
    await registerUser({ name: 'Unverified FP', email: email('fp-unverified'), password: 'password123' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('fp-unverified') });

    const user = await prisma.user.findUnique({ where: { email: email('fp-unverified') } });
    expect(user!.passwordResetToken).toBeNull();
  });

  it('400 — missing email field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

describe('POST /api/v1/auth/reset-password', () => {
  it('200 — valid token; old password rejected, new password accepted', async () => {
    await registerAndVerify('rp-ok');
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('rp-ok') });

    const user = await prisma.user.findUnique({ where: { email: email('rp-ok') } });
    const resetToken = user!.passwordResetToken!;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'newpassword456' });
    expect(res.status).toBe(200);

    expect((await loginUser('rp-ok', 'password123')).status).toBe(401);
    expect((await loginUser('rp-ok', 'newpassword456')).status).toBe(200);
  });

  it('400 — unknown token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'invalid-reset-token', password: 'newpassword456' });
    expect(res.status).toBe(400);
  });

  it('400 — expired token', async () => {
    await registerAndVerify('rp-expired');
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('rp-expired') });

    const user = await prisma.user.findUnique({ where: { email: email('rp-expired') } });
    await prisma.user.update({
      where: { id: user!.id },
      data: { passwordResetExpiry: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: user!.passwordResetToken, password: 'newpassword456' });
    expect(res.status).toBe(400);
  });

  it('400 — new password shorter than 8 chars', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'any-token', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('400 — reset token is single-use; second call is rejected', async () => {
    await registerAndVerify('rp-once');
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: email('rp-once') });

    const user = await prisma.user.findUnique({ where: { email: email('rp-once') } });
    const token = user!.passwordResetToken!;

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'firstnewpass' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'secondnewpass' });
    expect(res.status).toBe(400);
  });
});

// ─── JWT guard ────────────────────────────────────────────────────────────────
// Full guard coverage (401 on missing token, 403 on wrong role) is tested via
// the Users / Events endpoints once those modules are implemented (Phase 3).
