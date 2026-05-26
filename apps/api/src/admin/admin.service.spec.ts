import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const ADMIN_ID = 'admin-1';
const EVENT_ID = 'event-1';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  event: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  expense: {
    aggregate: jest.fn(),
  },
  refreshToken: {
    deleteMany: jest.fn(),
  },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    function setupStats({
      totalUsers = 10,
      totalEvents = 5,
      activeEvents = 3,
      archivedEvents = 2,
      vndSum = 1_500_000 as number | null,
    } = {}) {
      mockPrisma.user.count.mockResolvedValue(totalUsers);
      mockPrisma.event.count
        .mockResolvedValueOnce(totalEvents)
        .mockResolvedValueOnce(activeEvents)
        .mockResolvedValueOnce(archivedEvents);
      mockPrisma.expense.aggregate.mockResolvedValue({
        _sum: { amount: vndSum },
      });
    }

    it('returns correct stats', async () => {
      setupStats();

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 10,
        totalEvents: 5,
        activeEvents: 3,
        archivedEvents: 2,
        totalVnd: 1_500_000,
      });
    });

    it('returns totalVnd = 0 when no expenses exist', async () => {
      setupStats({ vndSum: null });

      const result = await service.getStats();

      expect(result.totalVnd).toBe(0);
    });

    it('returns totalVnd as a JS number (not Prisma Decimal object)', async () => {
      setupStats({ vndSum: 999_000 });

      const result = await service.getStats();

      expect(typeof result.totalVnd).toBe('number');
    });
  });

  // ─── getUsers ─────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    const userRow = {
      id: USER_ID,
      name: 'Test User',
      email: 'test@example.com',
      role: UserRole.USER,
      isActive: true,
      emailVerified: true,
      avatarUrl: null,
      createdAt: new Date(),
    };

    it('returns paginated user list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userRow]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({ page: 1, limit: 20 });

      expect(result).toMatchObject({
        items: [userRow],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('skips correctly for page 2', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(30);

      await service.getUsers({ page: 2, limit: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('does not expose passwordHash in the select', async () => {
      mockPrisma.user.findMany.mockResolvedValue([userRow]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({ page: 1, limit: 20 });

      const selectArg = mockPrisma.user.findMany.mock.calls[0][0].select;
      expect(selectArg).not.toHaveProperty('passwordHash');
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });

    it('calculates totalPages correctly', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(45);

      const result = await service.getUsers({ page: 1, limit: 20 });

      expect(result.totalPages).toBe(3);
    });
  });

  // ─── updateUserStatus ─────────────────────────────────────────────────────

  describe('updateUserStatus', () => {
    it('throws 404 when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUserStatus(USER_ID, { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when target user is ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: ADMIN_ID, role: UserRole.ADMIN });

      await expect(
        service.updateUserStatus(ADMIN_ID, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deactivates user and deletes refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, role: UserRole.USER });
      const updated = { id: USER_ID, isActive: false };
      mockPrisma.user.update.mockResolvedValue(updated);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.updateUserStatus(USER_ID, { isActive: false });

      expect(result).toBe(updated);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });

    it('activates user without touching refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, role: UserRole.USER });
      const updated = { id: USER_ID, isActive: true };
      mockPrisma.user.update.mockResolvedValue(updated);

      await service.updateUserStatus(USER_ID, { isActive: true });

      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ─── getEvents ────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    const eventRow = {
      id: EVENT_ID,
      name: 'Da Lat trip',
      type: 'TRIP',
      status: EventStatus.ACTIVE,
      createdAt: new Date(),
      organizer: { id: 'org-1', name: 'Organizer', email: 'org@example.com' },
      _count: { members: 3 },
    };

    it('returns paginated event list excluding soft-deleted', async () => {
      mockPrisma.event.findMany.mockResolvedValue([eventRow]);
      mockPrisma.event.count.mockResolvedValue(1);

      const result = await service.getEvents({ page: 1, limit: 20 });

      expect(result).toMatchObject({
        items: [eventRow],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });

    it('skips correctly for page 3', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(60);

      await service.getEvents({ page: 3, limit: 10 });

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('member count filter includes only ACTIVE members with removedAt null', async () => {
      mockPrisma.event.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);

      await service.getEvents({ page: 1, limit: 20 });

      const selectArg = mockPrisma.event.findMany.mock.calls[0][0].select;
      expect(selectArg._count.select.members.where).toMatchObject({
        status: 'ACTIVE',
        removedAt: null,
      });
    });
  });

  // ─── archiveEvent ─────────────────────────────────────────────────────────

  describe('archiveEvent', () => {
    it('throws 404 when event does not exist or is soft-deleted', async () => {
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(service.archiveEvent(EVENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when event is already ARCHIVED', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: EVENT_ID,
        status: EventStatus.ARCHIVED,
      });

      await expect(service.archiveEvent(EVENT_ID)).rejects.toThrow(BadRequestException);
    });

    it('archives an ACTIVE event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: EVENT_ID,
        status: EventStatus.ACTIVE,
      });
      const archived = { id: EVENT_ID, name: 'Da Lat', status: EventStatus.ARCHIVED };
      mockPrisma.event.update.mockResolvedValue(archived);

      const result = await service.archiveEvent(EVENT_ID);

      expect(result).toBe(archived);
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { status: EventStatus.ARCHIVED },
        select: { id: true, name: true, status: true },
      });
    });

    it('archives a SETTLED event', async () => {
      mockPrisma.event.findFirst.mockResolvedValue({
        id: EVENT_ID,
        status: EventStatus.SETTLED,
      });
      mockPrisma.event.update.mockResolvedValue({
        id: EVENT_ID,
        name: 'Da Lat',
        status: EventStatus.ARCHIVED,
      });

      const result = await service.archiveEvent(EVENT_ID);

      expect(result.status).toBe(EventStatus.ARCHIVED);
    });
  });
});
