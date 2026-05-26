import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, SettlementStatus } from '@prisma/client';
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

    const isMember = event.members.some((m) => m.userId === callerId);
    if (!isMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
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
    const uploadResult = await this.cloudinary.uploadBuffer(pdfBuffer, 'event-reports', publicId);

    return { url: uploadResult.secureUrl };
  }
}
