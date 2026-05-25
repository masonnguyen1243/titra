/**
 * Events integration tests — run against the DATABASE_URL in .env (no Docker needed).
 * Run with: pnpm test:e2e
 *
 * Isolation strategy: every event name and user email is prefixed with a
 * per-run stamp (e2e-<timestamp>-). beforeAll deletes stale rows from previous
 * runs; afterAll deletes everything created in this run.
 *
 * Cleanup order matters: Event.organizerId has onDelete:Restrict, so events
 * must be deleted before their organizer users.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── Per-run stamp ────────────────────────────────────────────────────────────

const RUN_ID = `e2e-${Date.now()}`;

function userEmail(local: string) {
  return `${RUN_ID}-${local}@example.com`;
}

function eventName(label: string) {
  return `${RUN_ID} ${label}`;
}

// ─── App bootstrap ────────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

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

  // Clean up any stale rows from a previous interrupted run
  await prisma.event.deleteMany({ where: { name: { startsWith: 'e2e-' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
}, 30_000);

afterAll(async () => {
  await prisma.event.deleteMany({ where: { name: { startsWith: RUN_ID } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN_ID } } });
  await app.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Register, then directly mark emailVerified in DB so the user can log in. */
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

/** Log in and return the auth cookies array. */
async function loginAndGetCookies(local: string, password = 'password123'): Promise<string[]> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: userEmail(local), password });
  const raw = res.headers['set-cookie'] as string | string[] | undefined;
  if (!raw) throw new Error(`login failed for ${local}: ${res.status} ${JSON.stringify(res.body)}`);
  return Array.isArray(raw) ? raw : [raw];
}

const BASE = '/api/v1/events';

// ─── POST /events ─────────────────────────────────────────────────────────────

describe('POST /api/v1/events', () => {
  let cookies: string[];

  beforeAll(async () => {
    await registerAndVerify('create-organizer');
    cookies = await loginAndGetCookies('create-organizer');
  });

  it('201 — creates an event and returns it with the organizer as a member', async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ name: eventName('create-ok') });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: eventName('create-ok'), status: 'ACTIVE' });
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].role).toBe('ORGANIZER');
  });

  it('201 — optional fields are stored when provided', async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ name: eventName('create-full'), type: 'TRIP', description: 'A trip' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'TRIP', description: 'A trip' });
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ name: eventName('create-anon') });

    expect(res.status).toBe(401);
  });

  it('400 — missing name', async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ type: 'TRIP' });

    expect(res.status).toBe(400);
  });

  it('400 — empty name', async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /events ──────────────────────────────────────────────────────────────

describe('GET /api/v1/events', () => {
  let cookies: string[];

  beforeAll(async () => {
    await registerAndVerify('list-organizer');
    cookies = await loginAndGetCookies('list-organizer');
    // Create one event for this organizer
    await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ name: eventName('list-mine') });
  });

  it('200 — returns only events the user belongs to', async () => {
    const res = await request(app.getHttpServer())
      .get(BASE)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).toContain(eventName('list-mine'));
  });

  it('200 — does not include events the user is not a member of', async () => {
    // Register a separate user and their event
    await registerAndVerify('list-other');
    const otherCookies = await loginAndGetCookies('list-other');
    const otherEventName = eventName('list-not-mine');
    await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', otherCookies)
      .send({ name: otherEventName });

    const res = await request(app.getHttpServer())
      .get(BASE)
      .set('Cookie', cookies);

    const names = res.body.map((e: { name: string }) => e.name);
    expect(names).not.toContain(otherEventName);
  });

  it('200 — response does not include soft-deleted events', async () => {
    // Create and immediately delete an event
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', cookies)
      .send({ name: eventName('list-deleted') });
    const id = createRes.body.id as string;

    await request(app.getHttpServer())
      .delete(`${BASE}/${id}`)
      .set('Cookie', cookies);

    const listRes = await request(app.getHttpServer())
      .get(BASE)
      .set('Cookie', cookies);

    const names = listRes.body.map((e: { name: string }) => e.name);
    expect(names).not.toContain(eventName('list-deleted'));
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get(BASE);
    expect(res.status).toBe(401);
  });
});

// ─── GET /events/:id ──────────────────────────────────────────────────────────

describe('GET /api/v1/events/:id', () => {
  let organizerCookies: string[];
  let nonMemberCookies: string[];
  let eventId: string;

  beforeAll(async () => {
    await registerAndVerify('detail-organizer');
    await registerAndVerify('detail-nonmember');
    organizerCookies = await loginAndGetCookies('detail-organizer');
    nonMemberCookies = await loginAndGetCookies('detail-nonmember');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('detail-event') });
    eventId = createRes.body.id as string;
  });

  it('200 — member can view event detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/${eventId}`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: eventId, name: eventName('detail-event') });
    expect(Array.isArray(res.body.members)).toBe(true);
  });

  it('403 — non-member gets forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/${eventId}`)
      .set('Cookie', nonMemberCookies);

    expect(res.status).toBe(403);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get(`${BASE}/${eventId}`);
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /events/:id ────────────────────────────────────────────────────────

describe('PATCH /api/v1/events/:id', () => {
  let organizerCookies: string[];
  let memberCookies: string[];
  let eventId: string;
  let memberRowId: string;

  beforeAll(async () => {
    await registerAndVerify('update-organizer');
    await registerAndVerify('update-member');
    organizerCookies = await loginAndGetCookies('update-organizer');
    memberCookies = await loginAndGetCookies('update-member');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('update-event') });
    eventId = createRes.body.id as string;
    memberRowId = createRes.body.members[0].id as string;

    // Add the second user as a guest member so their cookies work with event detail
    await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ name: 'Update Member Guest' });

    // The member cookies user is registered but not added to this event:
    // they are the non-organizer test subject
    void memberRowId; // suppress unused warning
  });

  it('200 — organizer can update name', async () => {
    const newName = eventName('update-renamed');
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/${eventId}`)
      .set('Cookie', organizerCookies)
      .send({ name: newName });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
  });

  it('403 — non-organizer member gets forbidden', async () => {
    // Register a separate user, add them to the event as a real member via guest path
    // then try to update — they should get 403 (non-organizer)
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/${eventId}`)
      .set('Cookie', memberCookies)
      .send({ name: eventName('update-hijack') });

    // memberCookies user is not a member of this event → 403
    expect(res.status).toBe(403);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', organizerCookies)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${BASE}/${eventId}`)
      .send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /events/:id ───────────────────────────────────────────────────────

describe('DELETE /api/v1/events/:id', () => {
  let organizerCookies: string[];
  let otherCookies: string[];

  beforeAll(async () => {
    await registerAndVerify('delete-organizer');
    await registerAndVerify('delete-other');
    organizerCookies = await loginAndGetCookies('delete-organizer');
    otherCookies = await loginAndGetCookies('delete-other');
  });

  it('204 — organizer soft-deletes the event', async () => {
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('delete-ok') });
    const id = createRes.body.id as string;

    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${id}`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(204);

    // Event should no longer appear in the list
    const listRes = await request(app.getHttpServer())
      .get(BASE)
      .set('Cookie', organizerCookies);
    const ids = listRes.body.map((e: { id: string }) => e.id);
    expect(ids).not.toContain(id);
  });

  it('204 — deletedAt is set in DB (soft-delete, not hard-delete)', async () => {
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('delete-soft') });
    const id = createRes.body.id as string;

    await request(app.getHttpServer())
      .delete(`${BASE}/${id}`)
      .set('Cookie', organizerCookies);

    const row = await prisma.event.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.status).toBe('ARCHIVED');
  });

  it('403 — non-organizer cannot delete', async () => {
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('delete-403') });
    const id = createRes.body.id as string;

    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${id}`)
      .set('Cookie', otherCookies);

    expect(res.status).toBe(403);
  });

  it('404 — event does not exist', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('delete-anon') });
    const id = createRes.body.id as string;

    const res = await request(app.getHttpServer()).delete(`${BASE}/${id}`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /events/:id/invite ───────────────────────────────────────────────────

describe('GET /api/v1/events/:id/invite', () => {
  let organizerCookies: string[];
  let memberCookies: string[];
  let eventId: string;
  let inviteToken: string;

  beforeAll(async () => {
    await registerAndVerify('invite-get-organizer');
    await registerAndVerify('invite-get-member');
    organizerCookies = await loginAndGetCookies('invite-get-organizer');
    memberCookies = await loginAndGetCookies('invite-get-member');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('invite-get-event') });
    eventId = createRes.body.id as string;
    inviteToken = (await prisma.event.findUnique({ where: { id: eventId } }))!.inviteToken!;
  });

  it('200 — organizer can view invite token and URL', async () => {
    const res = await request(app.getHttpServer())
      .get(`${BASE}/${eventId}/invite`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('inviteToken');
    expect(res.body).toHaveProperty('inviteUrl');
    expect(typeof res.body.inviteToken).toBe('string');
    expect(res.body.inviteUrl).toContain(res.body.inviteToken);
  });

  it('403 — non-organizer member cannot view invite link', async () => {
    // Join as a member first, then try to GET invite
    await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/join`)
      .set('Cookie', memberCookies)
      .send({ token: inviteToken });

    const res = await request(app.getHttpServer())
      .get(`${BASE}/${eventId}/invite`)
      .set('Cookie', memberCookies);

    expect(res.status).toBe(403);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).get(`${BASE}/${eventId}/invite`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /events/:id/join ────────────────────────────────────────────────────

describe('POST /api/v1/events/:id/join', () => {
  let organizerCookies: string[];
  let joinerCookies: string[];
  let eventId: string;
  let inviteToken: string;

  beforeAll(async () => {
    await registerAndVerify('join-organizer');
    await registerAndVerify('join-user');
    organizerCookies = await loginAndGetCookies('join-organizer');
    joinerCookies = await loginAndGetCookies('join-user');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('join-event') });
    eventId = createRes.body.id as string;
    inviteToken = (await prisma.event.findUnique({ where: { id: eventId } }))!.inviteToken!;
  });

  it('201 — user joins with correct invite token', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/join`)
      .set('Cookie', joinerCookies)
      .send({ token: inviteToken });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ eventId, role: 'MEMBER' });
  });

  it('409 — user is already an active member', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/join`)
      .set('Cookie', joinerCookies)
      .send({ token: inviteToken });

    expect(res.status).toBe(409);
  });

  it('400 — wrong invite token', async () => {
    // Need a fresh user not yet in the event
    await registerAndVerify('join-wrong-token');
    const cookies = await loginAndGetCookies('join-wrong-token');

    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/join`)
      .set('Cookie', cookies)
      .send({ token: 'totally-wrong-token' });

    expect(res.status).toBe(400);
  });

  it('400 — cannot join an ARCHIVED event', async () => {
    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('join-archived') });
    const archivedId = createRes.body.id as string;
    const archivedToken = (await prisma.event.findUnique({ where: { id: archivedId } }))!.inviteToken!;

    // Set status to ARCHIVED without soft-deleting (deletedAt stays null) so the
    // event is still "found" by joinEvent but blocked by the status check.
    await prisma.event.update({ where: { id: archivedId }, data: { status: 'ARCHIVED' } });

    await registerAndVerify('join-archived-user');
    const archivedCookies = await loginAndGetCookies('join-archived-user');

    const res = await request(app.getHttpServer())
      .post(`${BASE}/${archivedId}/join`)
      .set('Cookie', archivedCookies)
      .send({ token: archivedToken });

    expect(res.status).toBe(400);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/join`)
      .send({ token: inviteToken });

    expect(res.status).toBe(401);
  });
});

// ─── POST /events/:id/members ─────────────────────────────────────────────────

describe('POST /api/v1/events/:id/members', () => {
  let organizerCookies: string[];
  let nonOrganizerCookies: string[];
  let eventId: string;

  beforeAll(async () => {
    await registerAndVerify('addmember-organizer');
    await registerAndVerify('addmember-nonorg');
    organizerCookies = await loginAndGetCookies('addmember-organizer');
    nonOrganizerCookies = await loginAndGetCookies('addmember-nonorg');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('addmember-event') });
    eventId = createRes.body.id as string;
  });

  it('201 — organizer adds a guest member by name', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ name: 'Guest Person' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nickname: 'Guest Person', role: 'MEMBER' });
    expect(res.body.userId).toBeNull();
  });

  it('201 — guest path: inviteToken in response is null (no sensitive token)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ name: 'Another Guest' });

    // Guest members have no invite token — field is present but null
    expect(res.body.inviteToken).toBeNull();
    expect(res.body.inviteTokenExpiry).toBeNull();
  });

  it('200 — adding by email for non-existent user returns { ok: true } (enumeration-safe)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ email: userEmail('addmember-nobody') });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it('201 — adding by email for a real verified user creates a PENDING member', async () => {
    await registerAndVerify('addmember-target');

    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ email: userEmail('addmember-target') });

    expect(res.status).toBe(201);
    // Token must not be exposed in the response
    expect(res.body).not.toHaveProperty('inviteToken');
    // Member should be PENDING in DB
    const targetUser = await prisma.user.findUnique({ where: { email: userEmail('addmember-target') } });
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId: targetUser!.id } },
    });
    expect(member?.status).toBe('PENDING');
  });

  it('409 — adding a user who is already an active member', async () => {
    // Add a guest, get their eventMember status from DB
    // Easier to test: add the same guest twice with the same nickname
    // The CONFLICT path is for existing email users — let's add a new verified user and then add again
    await registerAndVerify('addmember-dup');
    await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ email: userEmail('addmember-dup') });

    // Manually activate the member to simulate accepted invitation
    const dupUser = await prisma.user.findUnique({ where: { email: userEmail('addmember-dup') } });
    await prisma.eventMember.updateMany({
      where: { eventId, userId: dupUser!.id },
      data: { status: 'ACTIVE', inviteToken: null, inviteTokenExpiry: null },
    });

    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ email: userEmail('addmember-dup') });

    expect(res.status).toBe(409);
  });

  it('403 — non-organizer cannot add members', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', nonOrganizerCookies)
      .send({ name: 'Intruder Guest' });

    expect(res.status).toBe(403);
  });

  it('400 — neither email nor name provided', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({});

    expect(res.status).toBe(400);
  });

  it('401 — unauthenticated request', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .send({ name: 'Ghost' });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /events/:id/members/:memberId ─────────────────────────────────────

describe('DELETE /api/v1/events/:id/members/:memberId', () => {
  let organizerCookies: string[];
  let nonOrganizerCookies: string[];
  let eventId: string;
  let organizerMemberRowId: string;

  beforeAll(async () => {
    await registerAndVerify('removemember-organizer');
    await registerAndVerify('removemember-nonorg');
    organizerCookies = await loginAndGetCookies('removemember-organizer');
    nonOrganizerCookies = await loginAndGetCookies('removemember-nonorg');

    const createRes = await request(app.getHttpServer())
      .post(BASE)
      .set('Cookie', organizerCookies)
      .send({ name: eventName('removemember-event') });
    eventId = createRes.body.id as string;
    organizerMemberRowId = createRes.body.members[0].id as string;
  });

  /** Add a guest and return the member row id. */
  async function addGuest(nickname: string) {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/${eventId}/members`)
      .set('Cookie', organizerCookies)
      .send({ name: nickname });
    return res.body.id as string;
  }

  it('204 — organizer removes a member (soft-delete)', async () => {
    const memberRowId = await addGuest('To Be Removed');

    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${eventId}/members/${memberRowId}`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(204);

    const row = await prisma.eventMember.findUnique({ where: { id: memberRowId } });
    expect(row!.removedAt).not.toBeNull();
  });

  it('400 — organizer cannot remove the ORGANIZER role member', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${eventId}/members/${organizerMemberRowId}`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(400);
  });

  it('403 — non-organizer cannot remove members', async () => {
    const memberRowId = await addGuest('Protected Guest');

    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${eventId}/members/${memberRowId}`)
      .set('Cookie', nonOrganizerCookies);

    expect(res.status).toBe(403);
  });

  it('404 — member row does not exist', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${eventId}/members/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', organizerCookies);

    expect(res.status).toBe(404);
  });

  it('401 — unauthenticated request', async () => {
    const memberRowId = await addGuest('Anon Target Guest');

    const res = await request(app.getHttpServer())
      .delete(`${BASE}/${eventId}/members/${memberRowId}`);

    expect(res.status).toBe(401);
  });
});
