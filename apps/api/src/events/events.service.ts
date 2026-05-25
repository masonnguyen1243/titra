import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

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
