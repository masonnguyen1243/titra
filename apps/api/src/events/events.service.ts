import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventStatus, MemberRole, MemberStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { JoinEventDto } from './dto/join-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEvents(userId: string) {
    return this.prisma.event.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId, status: MemberStatus.ACTIVE, removedAt: null } },
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
          where: { removedAt: null, status: MemberStatus.ACTIVE },
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
        members: { where: { userId, status: MemberStatus.ACTIVE, removedAt: null }, select: { id: true } },
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

  async joinEvent(eventId: string, userId: string, dto: JoinEventDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        id: true,
        status: true,
        inviteToken: true,
        members: { where: { userId, removedAt: null, status: MemberStatus.ACTIVE }, select: { id: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.status === EventStatus.ARCHIVED || event.status === EventStatus.SETTLED) {
      throw new BadRequestException('Sự kiện đã kết thúc, không thể tham gia');
    }

    if (event.inviteToken !== dto.token) {
      throw new BadRequestException('Mã mời không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // Check for an existing active membership
    const activeMember = event.members[0];
    if (activeMember) {
      throw new ConflictException('Bạn đã là thành viên của sự kiện này');
    }

    // Restore a previously removed membership if it exists
    const removedMember = await this.prisma.eventMember.findFirst({
      where: { eventId, userId, removedAt: { not: null } },
      select: { id: true },
    });

    if (removedMember) {
      return this.prisma.eventMember.update({
        where: { id: removedMember.id },
        data: { removedAt: null, joinedAt: new Date() },
      });
    }

    return this.prisma.eventMember.create({
      data: {
        eventId,
        userId,
        nickname: user.name,
        role: MemberRole.MEMBER,
      },
    });
  }

  async removeMember(eventId: string, callerId: string, memberId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { organizerId: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.organizerId !== callerId) {
      throw new ForbiddenException('Chỉ ban tổ chức mới có thể xoá thành viên');
    }

    const member = await this.prisma.eventMember.findFirst({
      where: { id: memberId, eventId, removedAt: null },
      select: { id: true, role: true },
    });

    if (!member) {
      throw new NotFoundException('Thành viên không tồn tại trong sự kiện này');
    }

    if (member.role === MemberRole.ORGANIZER) {
      throw new BadRequestException('Không thể xoá ban tổ chức khỏi sự kiện');
    }

    // Soft-delete: preserve financial history per spec §5.2
    await this.prisma.eventMember.update({
      where: { id: memberId },
      data: { removedAt: new Date() },
    });
  }

  async addMember(eventId: string, callerId: string, dto: AddMemberDto) {
    if (!dto.email && !dto.name) {
      throw new BadRequestException('Cần cung cấp email hoặc tên khách');
    }

    const [event, organizer] = await Promise.all([
      this.prisma.event.findFirst({
        where: { id: eventId, deletedAt: null },
        select: { organizerId: true, status: true, name: true, inviteToken: true },
      }),
      this.prisma.user.findUnique({
        where: { id: callerId },
        select: { name: true },
      }),
    ]);

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.organizerId !== callerId) {
      throw new ForbiddenException('Chỉ ban tổ chức mới có thể thêm thành viên');
    }

    if (event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Không thể thêm thành viên vào sự kiện đã lưu trữ');
    }

    if (dto.email) {
      const target = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true, name: true, isActive: true, emailVerified: true },
      });

      if (!target) {
        // Enumeration-safe: don't reveal whether the email has an account
        return { ok: true };
      }

      if (!target.isActive) {
        throw new BadRequestException('Tài khoản người dùng này đã bị vô hiệu hoá');
      }

      if (!target.emailVerified) {
        throw new BadRequestException('Người dùng này chưa xác minh email, vui lòng yêu cầu họ xác minh trước');
      }

      const existing = await this.prisma.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId: target.id } },
        select: { id: true, removedAt: true, status: true },
      });

      const inviteToken = randomUUID();
      const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      let member;
      if (existing) {
        if (existing.removedAt === null && existing.status === MemberStatus.ACTIVE) {
          throw new ConflictException('Người dùng này đã là thành viên của sự kiện');
        }
        // Re-invite: either previously removed or pending (never accepted)
        member = await this.prisma.eventMember.update({
          where: { id: existing.id },
          data: {
            removedAt: null,
            joinedAt: new Date(),
            status: MemberStatus.PENDING,
            inviteToken,
            inviteTokenExpiry,
          },
        });
      } else {
        member = await this.prisma.eventMember.create({
          data: {
            eventId,
            userId: target.id,
            nickname: target.name,
            role: MemberRole.MEMBER,
            status: MemberStatus.PENDING,
            inviteToken,
            inviteTokenExpiry,
          },
        });
      }

      void this.sendEventInviteEmail(
        dto.email,
        target.name,
        organizer?.name ?? 'Ban tổ chức',
        event.name,
        inviteToken,
      );

      return member;
    }

    // Guest path: userId is null, nickname is the provided name
    return this.prisma.eventMember.create({
      data: { eventId, userId: null, nickname: dto.name!, role: MemberRole.MEMBER },
    });
  }

  async acceptInvitation(eventId: string, userId: string, token: string) {
    const member = await this.prisma.eventMember.findFirst({
      where: { eventId, inviteToken: token, removedAt: null },
      select: { id: true, userId: true, status: true, inviteTokenExpiry: true },
    });

    if (!member) {
      throw new NotFoundException('Lời mời không hợp lệ hoặc đã được sử dụng');
    }

    if (member.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chấp nhận lời mời này');
    }

    if (member.status === MemberStatus.ACTIVE) {
      throw new ConflictException('Bạn đã là thành viên của sự kiện này');
    }

    if (member.inviteTokenExpiry && member.inviteTokenExpiry < new Date()) {
      throw new BadRequestException('Lời mời đã hết hạn, vui lòng liên hệ ban tổ chức để được mời lại');
    }

    return this.prisma.eventMember.update({
      where: { id: member.id },
      data: { status: MemberStatus.ACTIVE, inviteToken: null, inviteTokenExpiry: null },
    });
  }

  private async sendEventInviteEmail(
    email: string,
    recipientName: string,
    organizerName: string,
    eventName: string,
    inviteToken: string,
  ) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    const eventUrl = `${appUrl}/invitations/accept?token=${inviteToken}`;

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(`[DEV] Event invite notification sent to ${email} for event "${eventName}" (${eventUrl})`);
      return;
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      const result = await resend.emails.send({
        from: process.env['EMAIL_FROM'] ?? 'onboarding@resend.dev',
        to: email,
        subject: `Bạn được mời vào sự kiện "${escapeHtml(eventName)}" — Titra`,
        html: `
          <p>Xin chào ${escapeHtml(recipientName)},</p>
          <p><strong>${escapeHtml(organizerName)}</strong> đã mời bạn tham gia sự kiện <strong>${escapeHtml(eventName)}</strong> trên Titra.</p>
          <p>Nhấn vào liên kết dưới đây để chấp nhận lời mời (có hiệu lực trong 48 giờ):</p>
          <p><a href="${eventUrl}">${eventUrl}</a></p>
          <p>Nếu bạn không biết về lời mời này, hãy bỏ qua email này.</p>
        `,
      });
      if (result.error) {
        this.logger.error(`Resend rejected event invite email to ${email}: ${JSON.stringify(result.error)}`);
      } else {
        this.logger.log(`Event invite email sent to ${email} (id: ${result.data?.id})`);
      }
    } catch (err) {
      this.logger.error(`Failed to send event invite email to ${email}`, err);
    }
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
