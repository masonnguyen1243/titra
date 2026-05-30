import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MSG_SELECT = {
  id: true,
  content: true,
  createdAt: true,
  member: {
    select: {
      id: true,
      userId: true,
      nickname: true,
      user: { select: { name: true, avatarUrl: true } },
    },
  },
} as const;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveActiveMember(eventId: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Sự kiện không tồn tại');

    const member = await this.prisma.eventMember.findFirst({
      where: { eventId, userId, removedAt: null, status: MemberStatus.ACTIVE },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');

    return member;
  }

  async getMessages(eventId: string, userId: string, cursor?: string, limit = 50) {
    await this.resolveActiveMember(eventId, userId);

    const messages = await this.prisma.message.findMany({
      where: { eventId },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: MSG_SELECT,
    });

    // Reverse to chronological order for display (oldest → newest)
    const ordered = [...messages].reverse();

    return {
      messages: ordered,
      // Cursor pointing to the oldest message in this page for "load more older" requests
      nextCursor: messages.length === limit ? (messages[messages.length - 1]?.id ?? null) : null,
    };
  }

  async createMessage(eventId: string, userId: string, content: string) {
    const member = await this.resolveActiveMember(eventId, userId);

    return this.prisma.message.create({
      data: { eventId, memberId: member.id, content },
      select: MSG_SELECT,
    });
  }

  async isActiveMember(eventId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.eventMember.findFirst({
      where: {
        eventId,
        userId,
        removedAt: null,
        status: MemberStatus.ACTIVE,
        event: { deletedAt: null },
      },
      select: { id: true },
    });
    return !!member;
  }
}
