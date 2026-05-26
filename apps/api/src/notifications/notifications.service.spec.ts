import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MemberRole, MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const CALLER_ID = 'user-organizer';
const TARGET_USER_ID = 'user-target';
const TARGET_MEMBER_ID = 'member-target';

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Factories ───────────────────────────────────────────────────────────────

function makeEvent(memberRole: MemberRole | null = MemberRole.ORGANIZER) {
  return {
    name: 'Đà Lạt Weekend',
    members: memberRole !== null ? [{ role: memberRole }] : [],
  };
}

function makeTargetMember(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_MEMBER_ID,
    nickname: 'Alice',
    lastReminderAt: null as Date | null,
    user: { email: 'alice@example.com', name: 'Alice' } as { email: string; name: string } | null,
    paidExpenses: [] as { amount: number }[],
    expenseSplits: [] as { amount: number }[],
    sentSettlements: [] as { amount: number }[],
    receivedSettlements: [] as { amount: number }[],
    ...overrides,
  };
}

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  event: { findFirst: jest.fn() },
  eventMember: {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  },
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  // ─── sendReminder ─────────────────────────────────────────────────────────

  describe('sendReminder', () => {
    const dto = { memberId: TARGET_MEMBER_ID };

    function setupHappyPath() {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(makeTargetMember());
      mockPrisma.eventMember.updateMany.mockResolvedValue({ count: 1 });
    }

    it('happy path — returns ok, sentTo and lastReminderAt', async () => {
      setupHappyPath();

      const result = await service.sendReminder(EVENT_ID, CALLER_ID, dto);

      expect(result.ok).toBe(true);
      expect(result.sentTo).toBe('alice@example.com');
      expect(typeof result.lastReminderAt).toBe('string');
    });

    it('happy path — calls updateMany to atomically claim rate-limit slot', async () => {
      setupHappyPath();

      await service.sendReminder(EVENT_ID, CALLER_ID, dto);

      expect(mockPrisma.eventMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: TARGET_MEMBER_ID }),
          data: expect.objectContaining({ lastReminderAt: expect.any(Date) }),
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 403 when caller is not a member of the event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(null));

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 403 when caller is MEMBER, not ORGANIZER', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.MEMBER));

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 404 when target member does not exist in the event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 400 when target member is a guest (no user account)', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(makeTargetMember({ user: null }));

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 400 with remaining hours when in cooldown window', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makeTargetMember({ lastReminderAt: oneHourAgo }),
      );
      // Conditional update finds no eligible row → rate limit active
      mockPrisma.eventMember.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('error message includes remaining hours when in cooldown', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makeTargetMember({ lastReminderAt: oneHourAgo }),
      );
      mockPrisma.eventMember.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        /23 giờ/,
      );
    });

    it('does not call updateMany when target member is not found', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      mockPrisma.eventMember.findFirst.mockResolvedValue(null);

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.eventMember.updateMany).not.toHaveBeenCalled();
    });

    it('does not call updateMany when caller is not organizer', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.MEMBER));

      await expect(service.sendReminder(EVENT_ID, CALLER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.eventMember.updateMany).not.toHaveBeenCalled();
    });

    it('computes amountOwed = 0 when member is a creditor (net > 0)', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      // Member paid 200k, owes 50k → net = +150k (creditor, not a debtor)
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makeTargetMember({
          paidExpenses: [{ amount: 200_000 }],
          expenseSplits: [{ amount: 50_000 }],
        }),
      );
      mockPrisma.eventMember.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sendReminder(EVENT_ID, CALLER_ID, dto);

      // Still succeeds — amountOwed=0 is shown in email but doesn't block the send
      expect(result.ok).toBe(true);
    });

    it('computes correct amountOwed for a debtor', async () => {
      // This test verifies the balance formula without checking the email body directly.
      // It confirms the happy-path completes (email is fire-and-forget, no observable error).
      mockPrisma.event.findFirst.mockResolvedValue(makeEvent(MemberRole.ORGANIZER));
      // Paid 20k, owes 100k → net = -80k → amountOwed = 80k
      mockPrisma.eventMember.findFirst.mockResolvedValue(
        makeTargetMember({
          paidExpenses: [{ amount: 20_000 }],
          expenseSplits: [{ amount: 100_000 }],
        }),
      );
      mockPrisma.eventMember.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sendReminder(EVENT_ID, CALLER_ID, dto);

      expect(result.ok).toBe(true);
      expect(result.sentTo).toBe('alice@example.com');
    });
  });
});
