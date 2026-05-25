import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const EVENT_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  type: true,
  status: true,
  coverImageUrl: true,
  organizerId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true } },
} as const;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(userId: string) {
    return this.prisma.event.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId } },
      },
      select: EVENT_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEventDetail(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        members: {
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          select: {
            id: true,
            userId: true,
            nickname: true,
            role: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const isMember = event.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    return event;
  }

  async getInvite(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        inviteToken: true,
        members: { where: { userId }, select: { id: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.members.length === 0) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    return {
      inviteToken: event.inviteToken,
      inviteUrl: `${appUrl}/join/${event.inviteToken}`,
    };
  }

  async updateEvent(eventId: string, userId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { organizerId: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.organizerId !== userId) {
      throw new ForbiddenException('Chỉ ban tổ chức mới có thể chỉnh sửa sự kiện');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
      },
    });
  }

  async deleteEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { organizerId: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.organizerId !== userId) {
      throw new ForbiddenException('Chỉ ban tổ chức mới có thể xoá sự kiện');
    }

    await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date(), status: EventStatus.ARCHIVED },
    });
  }

  async createEvent(userId: string, dto: CreateEventDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          name: dto.name,
          type: dto.type,
          description: dto.description,
          coverImageUrl: dto.coverImageUrl,
          organizerId: userId,
        },
      });

      const member = await tx.eventMember.create({
        data: {
          eventId: event.id,
          userId,
          nickname: user.name,
          role: MemberRole.ORGANIZER,
        },
      });

      return {
        ...event,
        members: [member],
      };
    });
  }
}
