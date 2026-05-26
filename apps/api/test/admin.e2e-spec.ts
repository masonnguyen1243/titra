/**
 * Admin integration tests — run against the DATABASE_URL in .env (no Docker needed).
 * Run with: pnpm test:e2e --testPathPattern=admin
 *
 * Isolation strategy: per-run prefix on user emails and event names.
 *
 * User setup:
 *   - adminUser: registered normally, then role promoted to ADMIN via Prisma.
 *   - regularUser: a standard USER for 403 tests and deactivation target.
 *   - targetUser: a separate USER used as the deactivation/reactivation target so
 *     adminUser's own cookies remain valid throughout the suite.
 *
 * Event setup:
 *   - sharedEvent: created by adminUser; used for GET /admin/events tests.
 *   - archiveEvent: created by adminUser; used for PATCH /admin/events/:id/archive tests.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, UserRole } from '@prisma/client';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Per-run stamp ────────────────────────────────────────────────────────────

const RUN_ID = `e2e-admin-${Date.now()}`;

function userEmail(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

// ─── Shared state ─────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

let adminCookies: string[];
let regularCookies: string[]; // non-admin user
let adminUserId: string;
let regularUserId: string;
let targetUserId: string; // dedicated deactivation target
let sharedEventId: string;
let archiveEventId: string; // dedicated archive target

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function registerAndVerify(local: string, password = 'password123') {
  const addr = userEmail(local);
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ name: `User ${local}`, email: addr, password });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: addr } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return user;
}

async function loginAndGetCookies(local: string, password = 'password123'): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: userEmail(local), password });
  const raw = res.headers['set-cookie'] as string | string[] | undefined;
  if (!raw) throw new Error(`login failed for ${local}: ${res.status} ${JSON.stringify(res.body)}`);
  return Array.isArray(raw) ? raw : [raw];
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env['JWT_SECRET'] ??= 'e2e-jwt-secret-32chars-minimum!!';
  process.env['JWT_REFRESH_SECRET'] ??= 'e2e-refresh-secret-32chars-min!!';

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

  // Clean up stale rows from previous interrupted runs
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });

  // Register users
  const adminUser = await registerAndVerify('admin');
  const regularUser = await registerAndVerify('regular');
  const targetUser = await registerAndVerify('target');

  adminUserId = adminUser.id;
  regularUserId = regularUser.id;
  targetUserId = targetUser.id;

  // Promote adminUser to ADMIN role
  await prisma.user.update({ where: { id: adminUserId }, data: { role: UserRole.ADMIN } });

  adminCookies = await loginAndGetCookies('admin');
  regularCookies = await loginAndGetCookies('regular');

  // Create two events via admin (re-login picks up ADMIN role in JWT)
  const sharedEventRes = await request(app.getHttpServer())
    .post('/api/v1/events')
    .set('Cookie', adminCookies)
    .send({ name: `${RUN_ID} Shared Event` });

  if (sharedEventRes.status !== 201) {
    throw new Error(`createSharedEvent failed: ${sharedEventRes.status} ${JSON.stringify(sharedEventRes.body)}`);
  }
  sharedEventId = sharedEventRes.body.id as string;

  const archiveEventRes = await request(app.getHttpServer())
    .post('/api/v1/events')
    .set('Cookie', adminCookies)
    .send({ name: `${RUN_ID} Archive Event` });

  if (archiveEventRes.status !== 201) {
    throw new Error(`createArchiveEvent failed: ${archiveEventRes.status} ${JSON.stringify(archiveEventRes.body)}`);
  }
  archiveEventId = archiveEventRes.body.id as string;
}, 30_000);

afterAll(async () => {
  // Cascade: events → members, expenses, settlements
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

describe('GET /api/v1/admin/stats', () => {
  it('200 — admin receives stats with required fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalUsers: expect.any(Number),
      totalEvents: expect.any(Number),
      activeEvents: expect.any(Number),
      archivedEvents: expect.any(Number),
      totalVnd: expect.any(Number),
    });
  });

  it('200 — totalVnd is a plain number (not Decimal string or object)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalVnd).toBe('number');
  });

  it('403 — non-admin user is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Cookie', regularCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/stats');

    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

describe('GET /api/v1/admin/users', () => {
  it('200 — admin receives paginated user list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      limit: 20,
      totalPages: expect.any(Number),
    });
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('200 — passwordHash is not exposed in the response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    for (const user of res.body.items as Record<string, unknown>[]) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('200 — pagination parameters are respected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&limit=1')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  it('403 — non-admin user is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Cookie', regularCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/users');

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /admin/users/:id ───────────────────────────────────────────────────

describe('PATCH /api/v1/admin/users/:id', () => {
  it('200 — admin can deactivate a regular user', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}`)
      .set('Cookie', adminCookies)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: targetUserId, isActive: false });
  });

  it('200 — admin can reactivate a deactivated user', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}`)
      .set('Cookie', adminCookies)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: targetUserId, isActive: true });
  });

  it('400 — cannot change status of an ADMIN user', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${adminUserId}`)
      .set('Cookie', adminCookies)
      .send({ isActive: false });

    expect(res.status).toBe(400);
  });

  it('404 — user does not exist', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', adminCookies)
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });

  it('403 — non-admin user is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${regularUserId}`)
      .set('Cookie', regularCookies)
      .send({ isActive: false });

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${regularUserId}`)
      .send({ isActive: false });

    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/events ────────────────────────────────────────────────────────

describe('GET /api/v1/admin/events', () => {
  it('200 — admin receives paginated event list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/events')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      limit: 20,
      totalPages: expect.any(Number),
    });

    const found = (res.body.items as { id: string }[]).find((e) => e.id === sharedEventId);
    expect(found).toBeDefined();
  });

  it('200 — event items include organizer and member count', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/events')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    const event = (res.body.items as { id: string; organizer: unknown; _count: unknown }[])
      .find((e) => e.id === sharedEventId);
    expect(event?.organizer).toMatchObject({ id: adminUserId });
    expect(event?._count).toHaveProperty('members');
  });

  it('200 — pagination parameters are respected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/events?page=1&limit=1')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  it('403 — non-admin user is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/events')
      .set('Cookie', regularCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/events');

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /admin/events/:id/archive ─────────────────────────────────────────

describe('PATCH /api/v1/admin/events/:id/archive', () => {
  it('200 — admin can archive an ACTIVE event', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/events/${archiveEventId}/archive`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: archiveEventId, status: EventStatus.ARCHIVED });
  });

  it('400 — archiving an already-ARCHIVED event returns 400', async () => {
    // archiveEventId is now ARCHIVED from the previous test
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/events/${archiveEventId}/archive`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(400);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/admin/events/00000000-0000-0000-0000-000000000000/archive')
      .set('Cookie', adminCookies);

    expect(res.status).toBe(404);
  });

  it('403 — non-admin user is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/events/${sharedEventId}/archive`)
      .set('Cookie', regularCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).patch(
      `/api/v1/admin/events/${sharedEventId}/archive`,
    );

    expect(res.status).toBe(401);
  });
});
