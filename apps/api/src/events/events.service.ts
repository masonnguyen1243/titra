import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

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
