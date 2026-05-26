import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, MemberStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginateDto } from './dto/paginate.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(dto: PaginateDto) {
    const { page, limit } = dto;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Không thể thay đổi trạng thái tài khoản admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!dto.isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    return updated;
  }

  async getEvents(dto: PaginateDto) {
    const { page, limit } = dto;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
          organizer: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              members: {
                where: { status: MemberStatus.ACTIVE, removedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.event.count({ where: { deletedAt: null } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async archiveEvent(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Sự kiện đã được lưu trữ');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.ARCHIVED },
      select: { id: true, name: true, status: true },
    });
  }

  async getStats() {
    const [totalUsers, totalEvents, activeEvents, archivedEvents, vndResult] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.event.count({ where: { deletedAt: null } }),
        this.prisma.event.count({
          where: { deletedAt: null, status: EventStatus.ACTIVE },
        }),
        this.prisma.event.count({
          where: { deletedAt: null, status: EventStatus.ARCHIVED },
        }),
        this.prisma.expense.aggregate({
          where: { deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

    return {
      totalUsers,
      totalEvents,
      activeEvents,
      archivedEvents,
      totalVnd: Number(vndResult._sum.amount ?? 0),
    };
  }
}
