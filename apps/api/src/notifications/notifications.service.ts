import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SendReminderDto } from './dto/send-reminder.dto';

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendReminder(eventId: string, callerId: string, dto: SendReminderDto) {
    // Load event + caller membership in one query
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        name: true,
        members: {
          where: { userId: callerId, removedAt: null, status: MemberStatus.ACTIVE },
          select: { role: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const callerMember = event.members[0];
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }
    if (callerMember.role !== MemberRole.ORGANIZER) {
      throw new ForbiddenException('Chỉ ban tổ chức mới có thể gửi nhắc nhở');
    }

    // Load the target member with their user info
    const targetMember = await this.prisma.eventMember.findFirst({
      where: { id: dto.memberId, eventId, removedAt: null, status: MemberStatus.ACTIVE },
      select: {
        id: true,
        nickname: true,
        lastReminderAt: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Thành viên không tồn tại trong sự kiện này');
    }

    if (!targetMember.user) {
      throw new BadRequestException('Chỉ có thể gửi nhắc nhở cho thành viên có tài khoản');
    }

    // 24-hour rate limit per member
    if (targetMember.lastReminderAt) {
      const elapsed = Date.now() - targetMember.lastReminderAt.getTime();
      if (elapsed < REMINDER_COOLDOWN_MS) {
        const remainingMs = REMINDER_COOLDOWN_MS - elapsed;
        const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
        throw new BadRequestException(
          `Đã gửi nhắc nhở gần đây. Vui lòng chờ ${remainingHours} giờ nữa trước khi gửi lại`,
        );
      }
    }

    // Update lastReminderAt before sending so a second concurrent call is blocked
    await this.prisma.eventMember.update({
      where: { id: dto.memberId },
      data: { lastReminderAt: new Date() },
    });

    void this.sendReminderEmail(
      targetMember.user.email,
      targetMember.user.name,
      event.name,
    );

    return {
      ok: true,
      sentTo: targetMember.user.email,
      lastReminderAt: new Date().toISOString(),
    };
  }

  private async sendReminderEmail(
    email: string,
    name: string,
    eventName: string,
  ) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(`[DEV] Reminder email to ${email} for event "${eventName}"`);
      return;
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: process.env['EMAIL_FROM'] ?? 'onboarding@resend.dev',
        to: email,
        subject: `Nhắc nhở thanh toán — ${escapeHtml(eventName)} | Titra`,
        html: `
          <p>Xin chào ${escapeHtml(name)},</p>
          <p>Ban tổ chức của sự kiện <strong>${escapeHtml(eventName)}</strong> đã gửi nhắc nhở thanh toán cho bạn.</p>
          <p>Vui lòng truy cập Titra để xem chi tiết số dư và thực hiện thanh toán:</p>
          <p><a href="${appUrl}/dashboard">${appUrl}/dashboard</a></p>
          <p>Cảm ơn bạn đã sử dụng Titra!</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send reminder email to ${email}`, err);
    }
  }
}
