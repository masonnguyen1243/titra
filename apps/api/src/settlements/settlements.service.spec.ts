import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, MemberRole, MemberStatus, SettlementMethod, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementsService } from './settlements.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const SETTLEMENT_ID = 'settlement-1';
const ORGANIZER_ID = 'user-organizer';
const PAYER_ID = 'user-payer';
const RECIPIENT_ID = 'user-recipient';
const OTHER_ID = 'user-other';

const ORGANIZER_MEMBER_ID = 'member-organizer';
const PAYER_MEMBER_ID = 'member-payer';
const RECIPIENT_MEMBER_ID = 'member-recipient';

// ─── Factories ───────────────────────────────────────────────────────────────

function makeActiveEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    name: 'Test Event',
    status: EventStatus.ACTIVE,
    members: [],
    ...overrides,
  };
}

function makeMemberRow(userId: string, role: MemberRole, id: string) {
  return { id, role, userId, status: MemberStatus.ACTIVE, removedAt: null };
}

function makeSettlement(overrides: Record<string, unknown> = {}) {
  return {
    id: SETTLEMENT_ID,
    eventId: EVENT_ID,
    fromMemberId: PAYER_MEMBER_ID,
    toMemberId: RECIPIENT_MEMBER_ID,
    amount: 100_000,
    method: SettlementMethod.CASH,
    proofUrl: null,
    status: SettlementStatus.PENDING,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    fromMember: { id: PAYER_MEMBER_ID, nickname: 'Payer', userId: PAYER_ID },
    toMember: { id: RECIPIENT_MEMBER_ID, nickname: 'Recipient', userId: RECIPIENT_ID },
    ...overrides,
  };
}

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockPrisma = {
  event: { findFirst: jest.fn() },
  eventMember: { findFirst: jest.fn() },
  settlement: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('SettlementsService', () => {
  let service: SettlementsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SettlementsService);
  });

  // ─── createSettlement ─────────────────────────────────────────────────────

  describe('createSettlement', () => {
    const dto = { fromMemberId: PAYER_MEMBER_ID, toMemberId: RECIPIENT_MEMBER_ID, amount: 100_000 };

    it('happy path — returns created settlement', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent());
      // getActiveMember (caller)
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(PAYER_ID, MemberRole.MEMBER, PAYER_MEMBER_ID),
      );
      // fromMember lookup
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce({ id: PAYER_MEMBER_ID });
      // toMember lookup
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce({ id: RECIPIENT_MEMBER_ID });
      const created = makeSettlement();
      mockPrisma.settlement.create.mockResolvedValue(created);

      const result = await service.createSettlement(EVENT_ID, PAYER_ID, dto);

      expect(result).toBe(created);
      expect(mockPrisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.PENDING }),
        }),
      );
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 400 when event is SETTLED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent({ status: EventStatus.SETTLED }));

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 400 when event is ARCHIVED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent({ status: EventStatus.ARCHIVED }));

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 403 when caller is not an active member', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(null);

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 400 when fromMemberId equals toMemberId', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(PAYER_ID, MemberRole.MEMBER, PAYER_MEMBER_ID),
      );

      await expect(
        service.createSettlement(EVENT_ID, PAYER_ID, {
          fromMemberId: PAYER_MEMBER_ID,
          toMemberId: PAYER_MEMBER_ID,
          amount: 100_000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when fromMember is not found / not ACTIVE', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(PAYER_ID, MemberRole.MEMBER, PAYER_MEMBER_ID),
      );
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(null); // fromMember missing
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce({ id: RECIPIENT_MEMBER_ID });

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 404 when toMember is not found / not ACTIVE', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent());
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(PAYER_ID, MemberRole.MEMBER, PAYER_MEMBER_ID),
      );
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce({ id: PAYER_MEMBER_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(null); // toMember missing

      await expect(service.createSettlement(EVENT_ID, PAYER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── confirmSettlement ────────────────────────────────────────────────────

  describe('confirmSettlement', () => {
    function setupConfirm({
      callerRole = MemberRole.MEMBER as MemberRole,
      callerId = RECIPIENT_ID,
      settlementStatus = SettlementStatus.PENDING as SettlementStatus,
      recipientUserId = RECIPIENT_ID,
      eventStatus = EventStatus.ACTIVE as EventStatus,
    } = {}) {
      mockPrisma.event.findFirst.mockResolvedValue(
        makeActiveEvent({ status: eventStatus, members: [] }),
      );
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(callerId, callerRole, ORGANIZER_MEMBER_ID),
      );
      mockPrisma.settlement.findFirst.mockResolvedValue(
        makeSettlement({
          status: settlementStatus,
          toMember: { userId: recipientUserId },
        }),
      );
      mockPrisma.settlement.update.mockResolvedValue(
        makeSettlement({ status: SettlementStatus.CONFIRMED, confirmedAt: new Date() }),
      );
    }

    it('recipient can confirm a PENDING settlement', async () => {
      setupConfirm({ callerId: RECIPIENT_ID, recipientUserId: RECIPIENT_ID });

      const result = await service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID);

      expect(mockPrisma.settlement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: SettlementStatus.CONFIRMED }),
        }),
      );
      expect(result.status).toBe(SettlementStatus.CONFIRMED);
    });

    it('organizer can confirm a PENDING settlement', async () => {
      setupConfirm({ callerId: ORGANIZER_ID, callerRole: MemberRole.ORGANIZER, recipientUserId: RECIPIENT_ID });

      const result = await service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, ORGANIZER_ID);

      expect(mockPrisma.settlement.update).toHaveBeenCalled();
      expect(result.status).toBe(SettlementStatus.CONFIRMED);
    });

    it('throws 403 when caller is neither recipient nor organizer', async () => {
      setupConfirm({ callerId: OTHER_ID, recipientUserId: RECIPIENT_ID });

      await expect(
        service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when settlement is already CONFIRMED', async () => {
      setupConfirm({ settlementStatus: SettlementStatus.CONFIRMED, recipientUserId: RECIPIENT_ID });

      await expect(
        service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is SETTLED', async () => {
      setupConfirm({ eventStatus: EventStatus.SETTLED });

      await expect(
        service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 when event is ARCHIVED', async () => {
      setupConfirm({ eventStatus: EventStatus.ARCHIVED });

      await expect(
        service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when settlement does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(makeActiveEvent({ members: [] }));
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(RECIPIENT_ID, MemberRole.MEMBER, RECIPIENT_MEMBER_ID),
      );
      mockPrisma.settlement.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteSettlement ─────────────────────────────────────────────────────

  describe('deleteSettlement', () => {
    function setupDelete({
      callerRole = MemberRole.MEMBER as MemberRole,
      callerId = PAYER_ID,
      settlementStatus = SettlementStatus.PENDING as SettlementStatus,
      payerUserId = PAYER_ID,
      recipientUserId = RECIPIENT_ID,
    } = {}) {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(callerId, callerRole, PAYER_MEMBER_ID),
      );
      mockPrisma.settlement.findFirst.mockResolvedValue(
        makeSettlement({
          status: settlementStatus,
          fromMember: { userId: payerUserId },
          toMember: { userId: recipientUserId },
        }),
      );
      mockPrisma.settlement.delete.mockResolvedValue(undefined);
    }

    it('payer can delete a PENDING settlement', async () => {
      setupDelete({ callerId: PAYER_ID, payerUserId: PAYER_ID });

      await service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, PAYER_ID);

      expect(mockPrisma.settlement.delete).toHaveBeenCalledWith({
        where: { id: SETTLEMENT_ID },
      });
    });

    it('recipient can delete a PENDING settlement', async () => {
      setupDelete({ callerId: RECIPIENT_ID, recipientUserId: RECIPIENT_ID });

      await service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, RECIPIENT_ID);

      expect(mockPrisma.settlement.delete).toHaveBeenCalled();
    });

    it('organizer can delete a PENDING settlement', async () => {
      setupDelete({ callerId: ORGANIZER_ID, callerRole: MemberRole.ORGANIZER });

      await service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, ORGANIZER_ID);

      expect(mockPrisma.settlement.delete).toHaveBeenCalled();
    });

    it('throws 403 when caller is not payer, recipient, or organizer', async () => {
      setupDelete({ callerId: OTHER_ID, payerUserId: PAYER_ID, recipientUserId: RECIPIENT_ID });

      await expect(
        service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 when settlement is CONFIRMED', async () => {
      setupDelete({ settlementStatus: SettlementStatus.CONFIRMED });

      await expect(
        service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, PAYER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when event does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, PAYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when settlement does not exist', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(
        makeMemberRow(PAYER_ID, MemberRole.MEMBER, PAYER_MEMBER_ID),
      );
      mockPrisma.settlement.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, PAYER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when caller is not a member', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({ id: EVENT_ID });
      mockPrisma.eventMember.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.deleteSettlement(EVENT_ID, SETTLEMENT_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
