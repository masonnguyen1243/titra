import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus, SettlementStatus } from '@prisma/client';
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

    // Load the target member with their user info and balance data
    const targetMember = await this.prisma.eventMember.findFirst({
      where: { id: dto.memberId, eventId, removedAt: null, status: MemberStatus.ACTIVE },
      select: {
        id: true,
        nickname: true,
        lastReminderAt: true,
        user: { select: { email: true, name: true } },
        paidExpenses: {
          where: { deletedAt: null },
          select: { amount: true },
        },
        expenseSplits: {
          where: { expense: { deletedAt: null } },
          select: { amount: true },
        },
        sentSettlements: {
          where: { status: SettlementStatus.CONFIRMED },
          select: { amount: true },
        },
        receivedSettlements: {
          where: { status: SettlementStatus.CONFIRMED },
          select: { amount: true },
        },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Thành viên không tồn tại trong sự kiện này');
    }

    if (!targetMember.user) {
      throw new BadRequestException('Chỉ có thể gửi nhắc nhở cho thành viên có tài khoản');
    }

    // Calculate how much this member owes (negative net = debtor)
    const totalPaid = targetMember.paidExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalOwed = targetMember.expenseSplits.reduce((sum, s) => sum + s.amount, 0);
    const totalSettlementsPaid = targetMember.sentSettlements.reduce((sum, s) => sum + s.amount, 0);
    const totalSettlementsReceived = targetMember.receivedSettlements.reduce(
      (sum, s) => sum + s.amount,
      0,
    );
    const net = totalPaid - totalOwed + totalSettlementsPaid - totalSettlementsReceived;
    const amountOwed = net < 0 ? Math.abs(net) : 0;

    // Atomically claim the rate-limit slot. Two concurrent requests will race on this
    // update; exactly one wins (count=1). The WHERE condition is the gate — a request
    // only proceeds if no reminder has been sent in the last 24 hours.
    const cooldownThreshold = new Date(Date.now() - REMINDER_COOLDOWN_MS);
    const { count } = await this.prisma.eventMember.updateMany({
      where: {
        id: dto.memberId,
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cooldownThreshold } }],
      },
      data: { lastReminderAt: new Date() },
    });

    if (count === 0) {
      // Rate limit is active — compute remaining time from the value fetched earlier
      const elapsed = Date.now() - (targetMember.lastReminderAt?.getTime() ?? Date.now());
      const remainingMs = Math.max(REMINDER_COOLDOWN_MS - elapsed, 0);
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      throw new BadRequestException(
        `Đã gửi nhắc nhở gần đây. Vui lòng chờ ${remainingHours} giờ nữa trước khi gửi lại`,
      );
    }

    void this.sendReminderEmail(
      targetMember.user.email,
      targetMember.user.name,
      event.name,
      eventId,
      amountOwed,
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
    eventId: string,
    amountOwed: number,
  ) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    const eventUrl = `${appUrl}/events/${eventId}`;
    const settlementsUrl = `${appUrl}/events/${eventId}/settlements`;
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(amountOwed) + ' ₫';

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(
        `[DEV] Reminder email to ${email} for event "${eventName}", amount: ${formattedAmount}`,
      );
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
          <p>Số tiền bạn đang nợ: <strong>${escapeHtml(formattedAmount)}</strong></p>
          <p>Vui lòng truy cập sự kiện để xem chi tiết số dư và thực hiện thanh toán:</p>
          <p><a href="${eventUrl}">${escapeHtml(eventName)} — Xem chi tiết</a></p>
          <p>Thanh toán nhanh qua:</p>
          <ul>
            <li><a href="https://nhantien.momo.vn/">MoMo</a></li>
            <li><a href="https://vnpay.vn/">VNPay</a></li>
          </ul>
          <p>Sau khi thanh toán, hãy ghi nhận thanh toán trong ứng dụng: <a href="${settlementsUrl}">Ghi nhận thanh toán</a></p>
          <p>Cảm ơn bạn đã sử dụng Titra!</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send reminder email to ${email}`, err);
    }
  }
}
