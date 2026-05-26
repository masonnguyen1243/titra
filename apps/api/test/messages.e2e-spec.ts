/**
 * Messages integration tests — run against the DATABASE_URL in .env.
 * Run with: pnpm test:e2e --testPathPattern=messages
 *
 * Isolation strategy: per-run prefix on user emails and event names.
 * One event is shared across all describe blocks. A second user (member)
 * is inserted directly via Prisma to bypass the invite flow.
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

const RUN_ID = `e2e-msg-${Date.now()}`;

function userEmail(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

// ─── Shared state ─────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

let eventId: string;
let organizerCookies: string[];
let memberCookies: string[];  // ACTIVE member in the event
let otherCookies: string[];   // registered user NOT in the event

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

  // Clean up rows from any interrupted prior run
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
    throw new Error(
      `createEvent failed: ${createEventRes.status} ${JSON.stringify(createEventRes.body)}`,
    );
  }

  eventId = createEventRes.body.id as string;

  // Insert a second ACTIVE member directly via Prisma to bypass the invite flow
  const memberUser = await prisma.user.findUniqueOrThrow({
    where: { email: userEmail('member') },
  });

  await prisma.eventMember.create({
    data: {
      eventId,
      userId: memberUser.id,
      nickname: 'Member',
      role: MemberRole.MEMBER,
      status: MemberStatus.ACTIVE,
    },
  });
}, 30_000);

afterAll(async () => {
  // Events cascade-delete members and messages; delete events before users (organizerId FK).
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── GET /events/:id/messages ─────────────────────────────────────────────────

describe('GET /api/v1/events/:eventId/messages', () => {
  it('200 — organizer can fetch message history', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('200 — member can fetch message history', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', memberCookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('200 — returns messages with expected shape', async () => {
    // Post one message first so the list is non-empty
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies)
      .send({ content: 'shape-check message' });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    const first = res.body.messages[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      createdAt: expect.any(String),
      member: expect.objectContaining({ id: expect.any(String) }),
    });
  });

  it('200 — nextCursor is null when fewer messages than limit', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages?limit=100`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    // We have far fewer than 100 messages, so nextCursor must be null
    expect(res.body.nextCursor).toBeNull();
  });

  it('400 — invalid cursor value is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages?cursor=not-a-uuid`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(400);
  });

  it('403 — user not in the event cannot fetch messages', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', otherCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`);

    expect(res.status).toBe(401);
  });

  it('404 — non-existent event returns 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/events/00000000-0000-0000-0000-000000000000/messages')
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(404);
  });
});

// ─── POST /events/:id/messages ────────────────────────────────────────────────

describe('POST /api/v1/events/:eventId/messages', () => {
  it('201 — organizer can post a message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies)
      .send({ content: 'Hello from organizer' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(String),
      content: 'Hello from organizer',
      createdAt: expect.any(String),
      member: expect.objectContaining({ id: expect.any(String) }),
    });
  });

  it('201 — member can post a message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', memberCookies)
      .send({ content: 'Hello from member' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Hello from member');
  });

  it('201 — posted message appears in GET history', async () => {
    const content = `unique-${Date.now()}`;
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', memberCookies)
      .send({ content });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', memberCookies);

    const found = (listRes.body.messages as Array<{ content: string }>).find(
      (m) => m.content === content,
    );
    expect(found).toBeDefined();
  });

  it('400 — empty content is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('400 — content exceeding 2000 characters is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies)
      .send({ content: 'a'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('400 — missing content field is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', organizerCookies)
      .send({});

    expect(res.status).toBe(400);
  });

  it('403 — user not in the event cannot post a message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .set('Cookie', otherCookies)
      .send({ content: 'sneaky message' });

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/messages`)
      .send({ content: 'no auth' });

    expect(res.status).toBe(401);
  });

  it('404 — posting to a non-existent event returns 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events/00000000-0000-0000-0000-000000000000/messages')
      .set('Cookie', organizerCookies)
      .send({ content: 'ghost message' });

    expect(res.status).toBe(404);
  });
});
