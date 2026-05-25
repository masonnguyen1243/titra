import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, MemberRole, MemberStatus } from '@prisma/client';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

const ORGANIZER_ID = 'user-organizer';
const MEMBER_ID = 'user-member';
const EVENT_ID = 'event-1';
const MEMBER_ROW_ID = 'member-row-1';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    name: 'Test Event',
    type: 'TRIP',
    description: null,
    coverImageUrl: null,
    organizerId: ORGANIZER_ID,
    status: EventStatus.ACTIVE,
    inviteToken: 'invite-token-123',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMemberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBER_ROW_ID,
    eventId: EVENT_ID,
    userId: MEMBER_ID,
    nickname: 'Member Name',
    role: MemberRole.MEMBER,
    status: MemberStatus.ACTIVE,
    inviteToken: null,
    inviteTokenExpiry: null,
    removedAt: null,
    joinedAt: new Date(),
    ...overrides,
  };
}

const mockPrisma = {
  event: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  eventMember: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  // ---------------------------------------------------------------------------
  // createEvent
  // ---------------------------------------------------------------------------
  describe('createEvent', () => {
    it('creates event and organizer member inside a transaction', async () => {
      const user = { name: 'Organizer' };
      const event = makeEvent();
      const memberRow = makeMemberRow({ role: MemberRole.ORGANIZER, userId: ORGANIZER_ID });

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          event: { create: jest.fn().mockResolvedValue(event) },
          eventMember: { create: jest.fn().mockResolvedValue(memberRow) },
        };
        return fn(tx);
      });

      const result = await service.createEvent(ORGANIZER_ID, {
        name: 'Test Event',
      });

      expect(result).toMatchObject({ id: EVENT_ID, members: [memberRow] });
    });

    it('throws 404 when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createEvent('ghost-user', { name: 'Event' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getEvents
  // ---------------------------------------------------------------------------
  describe('getEvents', () => {
    it('returns events the user belongs to, excluding soft-deleted', async () => {
      const events = [makeEvent()];
      mockPrisma.event.findMany.mockResolvedValue(events);

      const result = await service.getEvents(ORGANIZER_ID);

      expect(result).toEqual(events);
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            members: expect.objectContaining({
              some: expect.objectContaining({ userId: ORGANIZER_ID }),
            }),
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getEventDetail
  // ---------------------------------------------------------------------------
  describe('getEventDetail', () => {
    it('returns event detail when the caller is a member', async () => {
      const event = {
        ...makeEvent(),
        members: [{ id: MEMBER_ROW_ID, userId: MEMBER_ID, nickname: 'Member', role: MemberRole.MEMBER, joinedAt: new Date() }],
      };
      mockPrisma.event.findFirst.mockResolvedValue(event);

      const result = await service.getEventDetail(EVENT_ID, MEMBER_ID);

      expect(result).toEqual(event);
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.getEventDetail(EVENT_ID, MEMBER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not a member', async () => {
      const event = {
        ...makeEvent(),
        members: [{ id: MEMBER_ROW_ID, userId: 'some-other-user', nickname: 'Other', role: MemberRole.MEMBER, joinedAt: new Date() }],
      };
      mockPrisma.event.findFirst.mockResolvedValue(event);

      await expect(service.getEventDetail(EVENT_ID, MEMBER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // updateEvent
  // ---------------------------------------------------------------------------
  describe('updateEvent', () => {
    it('updates and returns the event when caller is organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      const updated = makeEvent({ name: 'New Name' });
      mockPrisma.event.update.mockResolvedValue(updated);

      const result = await service.updateEvent(EVENT_ID, ORGANIZER_ID, { name: 'New Name' });

      expect(result).toEqual(updated);
      expect(mockPrisma.event.update).toHaveBeenCalled();
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.updateEvent(EVENT_ID, ORGANIZER_ID, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());

      await expect(
        service.updateEvent(EVENT_ID, MEMBER_ID, { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteEvent (soft-delete)
  // ---------------------------------------------------------------------------
  describe('deleteEvent', () => {
    it('soft-deletes the event when caller is organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.event.update.mockResolvedValue({});

      await service.deleteEvent(EVENT_ID, ORGANIZER_ID);

      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EVENT_ID },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            status: EventStatus.ARCHIVED,
          }),
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.deleteEvent(EVENT_ID, ORGANIZER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());

      await expect(service.deleteEvent(EVENT_ID, MEMBER_ID)).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // joinEvent
  // ---------------------------------------------------------------------------
  describe('joinEvent', () => {
    const user = { name: 'Member Name' };

    it('creates a new member row with the correct token', async () => {
      const event = makeEvent({ members: [] });
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.eventMember.findFirst.mockResolvedValue(null); // no removed member
      const newMember = makeMemberRow();
      mockPrisma.eventMember.create.mockResolvedValue(newMember);

      const result = await service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' });

      expect(result).toEqual(newMember);
      expect(mockPrisma.eventMember.create).toHaveBeenCalled();
    });

    it('restores a previously removed member', async () => {
      const event = makeEvent({ members: [] });
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const removedRow = makeMemberRow({ removedAt: new Date(Date.now() - 1000) });
      mockPrisma.eventMember.findFirst.mockResolvedValue(removedRow);
      const restored = makeMemberRow({ status: MemberStatus.ACTIVE });
      mockPrisma.eventMember.update.mockResolvedValue(restored);

      const result = await service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' });

      expect(result).toEqual(restored);
      expect(mockPrisma.eventMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ removedAt: null, status: MemberStatus.ACTIVE }),
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when event is ARCHIVED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.ARCHIVED, members: [] }));

      await expect(
        service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is SETTLED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.SETTLED, members: [] }));

      await expect(
        service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when invite token is wrong', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ members: [] }));
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'wrong-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 409 when user is already an active member', async () => {
      const event = makeEvent({ members: [{ id: MEMBER_ROW_ID }] });
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.joinEvent(EVENT_ID, MEMBER_ID, { token: 'invite-token-123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------------------------------------------------------------------------
  // removeMember
  // ---------------------------------------------------------------------------
  describe('removeMember', () => {
    it('soft-deletes the member when caller is organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValue(makeMemberRow({ role: MemberRole.MEMBER }));
      mockPrisma.eventMember.update.mockResolvedValue({});

      await service.removeMember(EVENT_ID, ORGANIZER_ID, MEMBER_ROW_ID);

      expect(mockPrisma.eventMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MEMBER_ROW_ID },
          data: expect.objectContaining({ removedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember(EVENT_ID, ORGANIZER_ID, MEMBER_ROW_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not the organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());

      await expect(
        service.removeMember(EVENT_ID, MEMBER_ID, MEMBER_ROW_ID),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.eventMember.update).not.toHaveBeenCalled();
    });

    it('throws 400 when event is SETTLED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.SETTLED }));

      await expect(
        service.removeMember(EVENT_ID, ORGANIZER_ID, MEMBER_ROW_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is ARCHIVED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.ARCHIVED }));

      await expect(
        service.removeMember(EVENT_ID, ORGANIZER_ID, MEMBER_ROW_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when member row does not exist in the event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember(EVENT_ID, ORGANIZER_ID, 'ghost-member-row'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when target member is the ORGANIZER', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makeMemberRow({ role: MemberRole.ORGANIZER }),
      );

      await expect(
        service.removeMember(EVENT_ID, ORGANIZER_ID, MEMBER_ROW_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // addMember — email path
  // ---------------------------------------------------------------------------
  describe('addMember (email path)', () => {
    const target = {
      id: 'target-user-id',
      name: 'Target User',
      isActive: true,
      emailVerified: true,
    };

    beforeEach(() => {
      // Default: active event, caller is organizer
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === ORGANIZER_ID) return Promise.resolve({ name: 'Organizer' });
        if (where.email === 'target@example.com') return Promise.resolve(target);
        return Promise.resolve(null);
      });
      mockPrisma.eventMember.findUnique.mockResolvedValue(null); // no existing membership
      mockPrisma.eventMember.create.mockResolvedValue(makeMemberRow({ userId: target.id, status: MemberStatus.PENDING }));
    });

    it('creates a PENDING member and returns safe response (no token fields)', async () => {
      const result = await service.addMember(EVENT_ID, ORGANIZER_ID, {
        email: 'target@example.com',
      });

      expect(result).not.toHaveProperty('inviteToken');
      expect(result).not.toHaveProperty('inviteTokenExpiry');
      expect(mockPrisma.eventMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MemberStatus.PENDING,
            userId: target.id,
          }),
        }),
      );
    });

    it('returns { ok: true } when user email does not exist (enumeration-safe)', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === ORGANIZER_ID) return Promise.resolve({ name: 'Organizer' });
        return Promise.resolve(null);
      });

      const result = await service.addMember(EVENT_ID, ORGANIZER_ID, {
        email: 'nobody@example.com',
      });

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.eventMember.create).not.toHaveBeenCalled();
    });

    it('returns { ok: true } when target user is inactive (enumeration-safe)', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === ORGANIZER_ID) return Promise.resolve({ name: 'Organizer' });
        if (where.email === 'inactive@example.com') return Promise.resolve({ ...target, isActive: false });
        return Promise.resolve(null);
      });

      const result = await service.addMember(EVENT_ID, ORGANIZER_ID, {
        email: 'inactive@example.com',
      });

      expect(result).toEqual({ ok: true });
    });

    it('returns { ok: true } when target user is not email-verified (enumeration-safe)', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === ORGANIZER_ID) return Promise.resolve({ name: 'Organizer' });
        if (where.email === 'unverified@example.com') return Promise.resolve({ ...target, emailVerified: false });
        return Promise.resolve(null);
      });

      const result = await service.addMember(EVENT_ID, ORGANIZER_ID, {
        email: 'unverified@example.com',
      });

      expect(result).toEqual({ ok: true });
    });

    it('throws 409 when user is already an active member', async () => {
      mockPrisma.eventMember.findUnique.mockResolvedValue(
        makeMemberRow({ userId: target.id, status: MemberStatus.ACTIVE, removedAt: null }),
      );

      await expect(
        service.addMember(EVENT_ID, ORGANIZER_ID, { email: 'target@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 403 when caller is not the organizer', async () => {
      await expect(
        service.addMember(EVENT_ID, MEMBER_ID, { email: 'target@example.com' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when event is ARCHIVED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.ARCHIVED }));

      await expect(
        service.addMember(EVENT_ID, ORGANIZER_ID, { email: 'target@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is SETTLED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent({ status: EventStatus.SETTLED }));

      await expect(
        service.addMember(EVENT_ID, ORGANIZER_ID, { email: 'target@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // addMember — guest path
  // ---------------------------------------------------------------------------
  describe('addMember (guest path)', () => {
    it('creates a member row with userId null using the provided name', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent());
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Organizer' });
      const guestRow = { ...makeMemberRow(), userId: null, nickname: 'Guest Person' };
      mockPrisma.eventMember.create.mockResolvedValue(guestRow);

      const result = await service.addMember(EVENT_ID, ORGANIZER_ID, { name: 'Guest Person' });

      expect(result).toMatchObject({ userId: null, nickname: 'Guest Person' });
      expect(mockPrisma.eventMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: null, nickname: 'Guest Person' }),
        }),
      );
    });

    it('throws 400 when neither email nor name is provided', async () => {
      await expect(
        service.addMember(EVENT_ID, ORGANIZER_ID, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // acceptInvitation
  // ---------------------------------------------------------------------------
  describe('acceptInvitation', () => {
    const futureExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const pastExpiry = new Date(Date.now() - 60 * 60 * 1000);

    function makePendingMemberWithEvent(overrides: Record<string, unknown> = {}) {
      return {
        id: MEMBER_ROW_ID,
        userId: MEMBER_ID,
        status: MemberStatus.PENDING,
        inviteTokenExpiry: futureExpiry,
        event: { deletedAt: null, status: EventStatus.ACTIVE },
        ...overrides,
      };
    }

    it('activates the member and clears invite token on happy path', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(makePendingMemberWithEvent());
      const activated = makeMemberRow({ status: MemberStatus.ACTIVE, inviteToken: null });
      mockPrisma.eventMember.update.mockResolvedValue(activated);

      const result = await service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token');

      expect(result).toEqual(activated);
      expect(mockPrisma.eventMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MemberStatus.ACTIVE,
            inviteToken: null,
            inviteTokenExpiry: null,
          }),
        }),
      );
    });

    it('throws 404 when invite token is not found', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'ghost-token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when userId does not match the invitation', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ userId: 'different-user' }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when member is already ACTIVE', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ status: MemberStatus.ACTIVE }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 400 when invite token is expired', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ inviteTokenExpiry: pastExpiry }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'expired-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event has been soft-deleted', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ event: { deletedAt: new Date(), status: EventStatus.ACTIVE } }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is SETTLED', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ event: { deletedAt: null, status: EventStatus.SETTLED } }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is ARCHIVED', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makePendingMemberWithEvent({ event: { deletedAt: null, status: EventStatus.ARCHIVED } }),
      );

      await expect(
        service.acceptInvitation(EVENT_ID, MEMBER_ID, 'valid-invite-token'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
