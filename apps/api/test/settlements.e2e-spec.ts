/**
 * Settlements integration tests — run against the DATABASE_URL in .env (no Docker needed).
 * Run with: pnpm test:e2e
 *
 * Isolation strategy: per-run prefix on user emails and event names.
 * One event is shared across all describe blocks; each test creates its own
 * settlement so that state changes (confirm, delete) don't bleed across tests.
 *
 * Member setup: after the organizer creates the event (organizer auto-added),
 * payer and recipient are inserted directly via Prisma to bypass the invite flow.
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

const RUN_ID = `e2e-sett-${Date.now()}`;

function userEmail(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

// ─── App bootstrap ────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

// Shared state — populated in the top-level beforeAll
let eventId: string;
let organizerCookies: string[];
let payerCookies: string[];
let recipientCookies: string[];
let otherCookies: string[]; // registered user NOT in the event
let payerMemberId: string;
let recipientMemberId: string;
let organizerMemberId: string;

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

/** Create a PENDING settlement via the API (payer → recipient). */
async function createPendingSettlement(): Promise<string> {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/events/${eventId}/settlements`)
    .set('Cookie', payerCookies)
    .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 100_000 });
  if (res.status !== 201) {
    throw new Error(`createPendingSettlement failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.id as string;
}

/** Create a PENDING settlement and then confirm it as the recipient. */
async function createConfirmedSettlement(): Promise<string> {
  const id = await createPendingSettlement();
  const confirmRes = await request(app.getHttpServer())
    .patch(`/api/v1/events/${eventId}/settlements/${id}/confirm`)
    .set('Cookie', recipientCookies);
  if (confirmRes.status !== 200) {
    throw new Error(`createConfirmedSettlement failed: ${confirmRes.status} ${JSON.stringify(confirmRes.body)}`);
  }
  return id;
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
  await prisma.event.deleteMany({ where: { name: { startsWith: 'e2e-sett-' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-sett-' } } });

  // Register and verify the four users
  await registerAndVerify('organizer');
  await registerAndVerify('payer');
  await registerAndVerify('recipient');
  await registerAndVerify('other');

  organizerCookies = await loginAndGetCookies('organizer');
  payerCookies = await loginAndGetCookies('payer');
  recipientCookies = await loginAndGetCookies('recipient');
  otherCookies = await loginAndGetCookies('other');

  // Create the shared event; organizer is auto-added as ORGANIZER member
  const createEventRes = await request(app.getHttpServer())
    .post('/api/v1/events')
    .set('Cookie', organizerCookies)
    .send({ name: `${RUN_ID} Test Event` });

  if (createEventRes.status !== 201) {
    throw new Error(`createEvent failed: ${createEventRes.status} ${JSON.stringify(createEventRes.body)}`);
  }

  eventId = createEventRes.body.id as string;
  organizerMemberId = createEventRes.body.members[0].id as string;

  // Retrieve payer and recipient users so we can set their userId on the members
  const payerUser = await prisma.user.findUniqueOrThrow({ where: { email: userEmail('payer') } });
  const recipientUser = await prisma.user.findUniqueOrThrow({
    where: { email: userEmail('recipient') },
  });

  // Insert payer and recipient as ACTIVE members directly, bypassing the invite flow
  const payerMember = await prisma.eventMember.create({
    data: {
      eventId,
      userId: payerUser.id,
      nickname: 'Payer',
      role: MemberRole.MEMBER,
      status: MemberStatus.ACTIVE,
    },
  });
  payerMemberId = payerMember.id;

  const recipientMember = await prisma.eventMember.create({
    data: {
      eventId,
      userId: recipientUser.id,
      nickname: 'Recipient',
      role: MemberRole.MEMBER,
      status: MemberStatus.ACTIVE,
    },
  });
  recipientMemberId = recipientMember.id;
}, 30_000);

afterAll(async () => {
  // Events cascade-delete settlements and members; delete events before users
  // because Event.organizerId has onDelete:Restrict.
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── POST /events/:eventId/settlements ────────────────────────────────────────

describe('POST /api/v1/events/:eventId/settlements', () => {
  it('201 — creates a settlement with PENDING status', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', payerCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 50_000 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      eventId,
      fromMemberId: payerMemberId,
      toMemberId: recipientMemberId,
      amount: 50_000,
      status: 'PENDING',
    });
  });

  it('201 — method defaults to CASH when omitted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', payerCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 20_000 });

    expect(res.status).toBe(201);
    expect(res.body.method).toBe('CASH');
  });

  it('400 — fromMemberId equals toMemberId', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', payerCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: payerMemberId, amount: 10_000 });

    expect(res.status).toBe(400);
  });

  it('400 — amount must be at least 1', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', payerCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 0 });

    expect(res.status).toBe(400);
  });

  it('403 — non-member cannot create settlement', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', otherCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 10_000 });

    expect(res.status).toBe(403);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events/00000000-0000-0000-0000-000000000000/settlements')
      .set('Cookie', payerCookies)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 10_000 });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/settlements`)
      .send({ fromMemberId: payerMemberId, toMemberId: recipientMemberId, amount: 10_000 });

    expect(res.status).toBe(401);
  });
});

// ─── GET /events/:eventId/settlements ────────────────────────────────────────

describe('GET /api/v1/events/:eventId/settlements', () => {
  beforeAll(async () => {
    // Seed at least one settlement so the list is non-empty
    await createPendingSettlement();
  });

  it('200 — member can list settlements', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', payerCookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({ eventId, status: expect.stringMatching(/PENDING|CONFIRMED/) });
  });

  it('403 — non-member cannot list settlements', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/settlements`)
      .set('Cookie', otherCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v1/events/${eventId}/settlements`,
    );

    expect(res.status).toBe(401);
  });
});

// ─── PATCH /events/:eventId/settlements/:id/confirm ───────────────────────────

describe('PATCH /api/v1/events/:eventId/settlements/:id/confirm', () => {
  it('200 — recipient can confirm a PENDING settlement', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/settlements/${id}/confirm`)
      .set('Cookie', recipientCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: 'CONFIRMED' });
    expect(res.body.confirmedAt).toBeTruthy();
  });

  it('200 — organizer can confirm a PENDING settlement', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/settlements/${id}/confirm`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');
  });

  it('403 — non-recipient / non-organizer cannot confirm', async () => {
    const id = await createPendingSettlement();

    // payerCookies user is the payer (fromMember), not the recipient or organizer
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/settlements/${id}/confirm`)
      .set('Cookie', payerCookies);

    expect(res.status).toBe(403);
  });

  it('400 — already CONFIRMED settlement cannot be confirmed again', async () => {
    const id = await createConfirmedSettlement();

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/settlements/${id}/confirm`)
      .set('Cookie', recipientCookies);

    expect(res.status).toBe(400);
  });

  it('404 — settlement does not exist', async () => {
    const res = await request(app.getHttpServer())
      .patch(
        `/api/v1/events/${eventId}/settlements/00000000-0000-0000-0000-000000000000/confirm`,
      )
      .set('Cookie', recipientCookies);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer()).patch(
      `/api/v1/events/${eventId}/settlements/${id}/confirm`,
    );

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /events/:eventId/settlements/:id ──────────────────────────────────

describe('DELETE /api/v1/events/:eventId/settlements/:id', () => {
  it('204 — payer (fromMember) can delete a PENDING settlement', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/settlements/${id}`)
      .set('Cookie', payerCookies);

    expect(res.status).toBe(204);
  });

  it('204 — recipient (toMember) can delete a PENDING settlement', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/settlements/${id}`)
      .set('Cookie', recipientCookies);

    expect(res.status).toBe(204);
  });

  it('204 — organizer can delete a PENDING settlement', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/settlements/${id}`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(204);
  });

  it('403 — unrelated member cannot delete', async () => {
    // Add a fifth user as a plain member to be the unrelated party
    await registerAndVerify('unrelated');
    const unrelatedUser = await prisma.user.findUniqueOrThrow({
      where: { email: userEmail('unrelated') },
    });
    await prisma.eventMember.create({
      data: {
        eventId,
        userId: unrelatedUser.id,
        nickname: 'Unrelated',
        role: MemberRole.MEMBER,
        status: MemberStatus.ACTIVE,
      },
    });
    const unrelatedCookies = await loginAndGetCookies('unrelated');

    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/settlements/${id}`)
      .set('Cookie', unrelatedCookies);

    expect(res.status).toBe(403);
  });

  it('400 — CONFIRMED settlement cannot be deleted', async () => {
    const id = await createConfirmedSettlement();

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/settlements/${id}`)
      .set('Cookie', payerCookies);

    expect(res.status).toBe(400);
  });

  it('404 — settlement does not exist', async () => {
    const res = await request(app.getHttpServer())
      .delete(
        `/api/v1/events/${eventId}/settlements/00000000-0000-0000-0000-000000000000`,
      )
      .set('Cookie', payerCookies);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const id = await createPendingSettlement();

    const res = await request(app.getHttpServer()).delete(
      `/api/v1/events/${eventId}/settlements/${id}`,
    );

    expect(res.status).toBe(401);
  });
});
