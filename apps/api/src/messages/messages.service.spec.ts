import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from './messages.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const USER_ID = 'user-1';
const MEMBER_ID = 'member-1';
const MSG_ID_1 = 'msg-1';
const MSG_ID_2 = 'msg-2';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeMessage(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    content: 'Hello',
    createdAt: new Date(),
    member: {
      id: MEMBER_ID,
      nickname: 'Alice',
      user: { name: 'Alice', avatarUrl: null },
    },
    ...overrides,
  };
}

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  event: { findFirst: jest.fn() },
  eventMember: { findFirst: jest.fn() },
  message: { findMany: jest.fn(), create: jest.fn() },
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MessagesService);
  });

  // ─── getMessages ───────────────────────────────────────────────────────────

  describe('getMessages', () => {
    function setupActiveMember() {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValue({ id: MEMBER_ID });
    }

    it('returns messages in chronological order for an active member', async () => {
      setupActiveMember();
      const msg1 = makeMessage(MSG_ID_1);
      const msg2 = makeMessage(MSG_ID_2);
      // findMany returns newest-first; service reverses to oldest-first
      mockPrisma.message.findMany.mockResolvedValue([msg2, msg1]);

      const result = await service.getMessages(EVENT_ID, USER_ID);

      expect(result.messages).toEqual([msg1, msg2]);
    });

    it('returns nextCursor when page is full', async () => {
      setupActiveMember();
      const messages = Array.from({ length: 50 }, (_, i) => makeMessage(`msg-${i}`));
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await service.getMessages(EVENT_ID, USER_ID, undefined, 50);

      expect(result.nextCursor).toBe('msg-49');
    });

    it('returns nextCursor as null when page is not full', async () => {
      setupActiveMember();
      mockPrisma.message.findMany.mockResolvedValue([makeMessage(MSG_ID_1)]);

      const result = await service.getMessages(EVENT_ID, USER_ID, undefined, 50);

      expect(result.nextCursor).toBeNull();
    });

    it('passes cursor to prisma query when provided', async () => {
      setupActiveMember();
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.getMessages(EVENT_ID, USER_ID, MSG_ID_1);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: MSG_ID_1 }, skip: 1 }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.getMessages(EVENT_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when user is not an active member', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(service.getMessages(EVENT_ID, USER_ID)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── createMessage ─────────────────────────────────────────────────────────

  describe('createMessage', () => {
    it('creates and returns a message for an active member', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValue({ id: MEMBER_ID });
      const msg = makeMessage(MSG_ID_1, { content: 'Hi' });
      mockPrisma.message.create.mockResolvedValue(msg);

      const result = await service.createMessage(EVENT_ID, USER_ID, 'Hi');

      expect(result).toEqual(msg);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { eventId: EVENT_ID, memberId: MEMBER_ID, content: 'Hi' },
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.createMessage(EVENT_ID, USER_ID, 'Hi')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 403 when user is not an active member', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(service.createMessage(EVENT_ID, USER_ID, 'Hi')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── isActiveMember ────────────────────────────────────────────────────────

  describe('isActiveMember', () => {
    it('returns true for an ACTIVE member with a non-deleted event', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue({ id: MEMBER_ID });

      const result = await service.isActiveMember(EVENT_ID, USER_ID);

      expect(result).toBe(true);
    });

    it('returns false when no matching member row exists', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      const result = await service.isActiveMember(EVENT_ID, USER_ID);

      expect(result).toBe(false);
    });

    it('queries with ACTIVE status, removedAt: null and deletedAt: null on event', async () => {
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await service.isActiveMember(EVENT_ID, USER_ID);

      expect(mockPrisma.eventMember.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: EVENT_ID,
            userId: USER_ID,
            removedAt: null,
            status: MemberStatus.ACTIVE,
            event: { deletedAt: null },
          }),
        }),
      );
    });
  });
});
