/**
 * Notifications integration tests — run against the DATABASE_URL in .env.
 * Run with: pnpm test:e2e --testPathPattern=notifications
 *
 * Isolation strategy: per-run prefix on emails and event names.
 * One event is shared; a debtor member is inserted directly via Prisma so the
 * invite flow is bypassed and every test starts with a clean lastReminderAt.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MemberRole, MemberStatus } from '@prisma/client';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Per-run stamp ────────────────────────────────────────────────────────────

const RUN_ID = `e2e-notif-${Date.now()}`;

function userEmail(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

// ─── Shared state ─────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

let eventId: string;
let organizerCookies: string[];
let memberCookies: string[];   // MEMBER (can receive reminders)
let otherCookies: string[];    // registered user NOT in the event
let debtorMemberId: string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndVerify(local: string, password = 'password123') {
  const addr = userEmail(local);
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ name: `User ${local}`, email: addr, password });
  const user = await prisma.user.findUnique({ where: { email: addr } });
  if (!user) throw new Error(`user not found after register: ${addr}`);
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

  // Clean up stale rows from interrupted prior runs
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });

  // Register and verify users
  await registerAndVerify('organizer');
  await registerAndVerify('member');
  await registerAndVerify('other');

  organizerCookies = await loginAndGetCookies('organizer');
  memberCookies = await loginAndGetCookies('member');
  otherCookies = await loginAndGetCookies('other');

  // Create event; organizer is auto-added as ORGANIZER member
  const createEventRes = await request(app.getHttpServer())
    .post('/api/v1/events')
    .set('Cookie', organizerCookies)
    .send({ name: `${RUN_ID} Test Event` });

  if (createEventRes.status !== 201) {
    throw new Error(`createEvent failed: ${createEventRes.status} ${JSON.stringify(createEventRes.body)}`);
  }

  eventId = createEventRes.body.id as string;

  // Insert the debtor member directly to bypass the invite flow
  const memberUser = await prisma.user.findUniqueOrThrow({
    where: { email: userEmail('member') },
  });

  const debtorMember = await prisma.eventMember.create({
    data: {
      eventId,
      userId: memberUser.id,
      nickname: 'Debtor',
      role: MemberRole.MEMBER,
      status: MemberStatus.ACTIVE,
    },
  });
  debtorMemberId = debtorMember.id;
}, 30_000);

afterAll(async () => {
  // Events cascade-delete members; delete events before users (organizerId FK).
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── POST /events/:eventId/reminders ─────────────────────────────────────────

describe('POST /api/v1/events/:eventId/reminders', () => {
  // Reset lastReminderAt before each test so the cooldown doesn't bleed across tests
  beforeEach(async () => {
    await prisma.eventMember.update({
      where: { id: debtorMemberId },
      data: { lastReminderAt: null },
    });
  });

  it('200 — organizer can send reminder to a member', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      sentTo: userEmail('member'),
      lastReminderAt: expect.any(String),
    });
  });

  it('200 — response lastReminderAt is a valid ISO timestamp', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(200);
    expect(new Date(res.body.lastReminderAt as string).toISOString()).toBe(res.body.lastReminderAt);
  });

  it('403 — regular member cannot send a reminder', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', memberCookies)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(403);
  });

  it('403 — user not in the event cannot send a reminder', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', otherCookies)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(403);
  });

  it('400 — second reminder within 24 h is rejected (cooldown)', async () => {
    // First reminder succeeds
    const first = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });
    expect(first.status).toBe(200);

    // Second reminder is blocked
    const second = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });
    expect(second.status).toBe(400);
  });

  it('400 — cooldown error message contains remaining hours', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });

    const second = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });

    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/giờ/);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events/00000000-0000-0000-0000-000000000000/reminders')
      .set('Cookie', organizerCookies)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(404);
  });

  it('404 — member does not exist in the event', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({ memberId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .send({ memberId: debtorMemberId });

    expect(res.status).toBe(401);
  });

  it('400 — missing memberId in request body', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reminders`)
      .set('Cookie', organizerCookies)
      .send({});

    expect(res.status).toBe(400);
  });
});
