import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus, SettlementStatus } from '@prisma/client';
import { BalanceService, MemberBalance } from '../expenses/balance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../upload/cloudinary.service';
import { generateEventPdf } from './pdf.generator';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async exportEventPdf(eventId: string, callerId: string): Promise<{ url: string }> {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        members: {
          where: { removedAt: null, status: MemberStatus.ACTIVE },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          select: {
            id: true,
            nickname: true,
            userId: true,
            role: true,
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
        },
        expenses: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            paidBy: { select: { id: true, nickname: true } },
            splits: {
              select: {
                amount: true,
                member: { select: { nickname: true } },
              },
            },
          },
        },
        settlements: {
          orderBy: { createdAt: 'asc' },
          include: {
            fromMember: { select: { nickname: true } },
            toMember: { select: { nickname: true } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const isOrganizer = event.members.some(
      (m) => m.userId === callerId && m.role === MemberRole.ORGANIZER,
    );
    if (!isOrganizer) {
      throw new ForbiddenException('Chỉ organizer mới có thể xuất báo cáo PDF');
    }

    const memberBalances: MemberBalance[] = event.members.map((m) => {
      const totalPaid = m.paidExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalOwed = m.expenseSplits.reduce((sum, s) => sum + s.amount, 0);
      const totalSettlementsPaid = m.sentSettlements.reduce((sum, s) => sum + s.amount, 0);
      const totalSettlementsReceived = m.receivedSettlements.reduce((sum, s) => sum + s.amount, 0);
      return {
        memberId: m.id,
        nickname: m.nickname,
        userId: m.userId,
        net: totalPaid - totalOwed + totalSettlementsPaid - totalSettlementsReceived,
      };
    });

    const balanceResult = this.balanceService.compute(memberBalances);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateEventPdf({ event, balances: balanceResult });
    } catch (err) {
      this.logger.error('PDF generation failed', err);
      throw new InternalServerErrorException('Không thể tạo file PDF, vui lòng thử lại');
    }

    const publicId = `event-reports/${eventId}-${Date.now()}`;
    const uploadResult = await this.cloudinary.uploadBuffer(
      pdfBuffer,
      'event-reports',
      publicId,
      { type: 'authenticated' },
    );

    // Signed URL valid for 24 hours — prevents permanent public exposure of financial data.
    const PDF_TTL_SECONDS = 24 * 60 * 60;
    const signedUrl = this.cloudinary.generateSignedUrl(uploadResult.publicId, PDF_TTL_SECONDS);

    const organizerMember = event.members.find(
      (m) => m.userId === callerId && m.role === MemberRole.ORGANIZER,
    );
    if (organizerMember?.user) {
      void this.sendPdfEmail(
        organizerMember.user.email,
        organizerMember.user.name,
        event.name,
        signedUrl,
      );
    }

    return { url: signedUrl };
  }

  private async sendPdfEmail(
    email: string,
    name: string,
    eventName: string,
    pdfUrl: string,
  ): Promise<void> {
    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(
        `[DEV] PDF email to ${email} for event "${eventName}", url: ${pdfUrl}`,
      );
      return;
    }

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: process.env['EMAIL_FROM'] ?? 'onboarding@resend.dev',
        to: email,
        subject: `Báo cáo PDF — ${escapeHtml(eventName)} | Titra`,
        html: `
          <p>Xin chào ${escapeHtml(name)},</p>
          <p>Báo cáo PDF cho sự kiện <strong>${escapeHtml(eventName)}</strong> đã sẵn sàng.</p>
          <p><a href="${pdfUrl}">Tải xuống báo cáo PDF</a></p>
          <p>Cảm ơn bạn đã sử dụng Titra!</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send PDF email to ${email}`, err);
    }
  }
}
