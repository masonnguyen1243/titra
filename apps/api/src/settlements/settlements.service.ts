import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, MemberRole, MemberStatus, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getActiveMember(eventId: string, userId: string) {
    const member = await this.prisma.eventMember.findFirst({
      where: { eventId, userId, removedAt: null, status: MemberStatus.ACTIVE },
      select: { id: true, role: true },
    });
    return member;
  }

  async createSettlement(eventId: string, callerId: string, dto: CreateSettlementDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { status: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.status === EventStatus.SETTLED || event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Không thể ghi nhận thanh toán trong sự kiện đã kết thúc');
    }

    const callerMember = await this.getActiveMember(eventId, callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    if (dto.fromMemberId === dto.toMemberId) {
      throw new BadRequestException('Người trả và người nhận không thể là cùng một người');
    }

    const [fromMember, toMember] = await Promise.all([
      this.prisma.eventMember.findFirst({
        where: { id: dto.fromMemberId, eventId, removedAt: null },
        select: { id: true },
      }),
      this.prisma.eventMember.findFirst({
        where: { id: dto.toMemberId, eventId, removedAt: null },
        select: { id: true },
      }),
    ]);

    if (!fromMember) {
      throw new NotFoundException('Người trả không tồn tại trong sự kiện này');
    }
    if (!toMember) {
      throw new NotFoundException('Người nhận không tồn tại trong sự kiện này');
    }

    return this.prisma.settlement.create({
      data: {
        eventId,
        fromMemberId: dto.fromMemberId,
        toMemberId: dto.toMemberId,
        amount: dto.amount,
        method: dto.method,
        proofUrl: dto.proofUrl,
        status: SettlementStatus.PENDING,
      },
      include: {
        fromMember: { select: { id: true, nickname: true, userId: true } },
        toMember: { select: { id: true, nickname: true, userId: true } },
      },
    });
  }

  async getSettlements(eventId: string, callerId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const callerMember = await this.getActiveMember(eventId, callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    return this.prisma.settlement.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromMember: { select: { id: true, nickname: true, userId: true } },
        toMember: { select: { id: true, nickname: true, userId: true } },
      },
    });
  }

  async confirmSettlement(eventId: string, settlementId: string, callerId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { status: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const callerMember = await this.getActiveMember(eventId, callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, eventId },
      include: {
        toMember: { select: { userId: true } },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Thanh toán không tồn tại');
    }

    if (settlement.status === SettlementStatus.CONFIRMED) {
      throw new BadRequestException('Thanh toán này đã được xác nhận');
    }

    // Only the recipient or an organizer can confirm
    const isRecipient = settlement.toMember.userId === callerId;
    const isOrganizer = callerMember.role === MemberRole.ORGANIZER;
    if (!isRecipient && !isOrganizer) {
      throw new ForbiddenException('Chỉ người nhận tiền hoặc ban tổ chức mới có thể xác nhận');
    }

    return this.prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: SettlementStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
      include: {
        fromMember: { select: { id: true, nickname: true, userId: true } },
        toMember: { select: { id: true, nickname: true, userId: true } },
      },
    });
  }

  async deleteSettlement(eventId: string, settlementId: string, callerId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const callerMember = await this.getActiveMember(eventId, callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, eventId },
      include: {
        fromMember: { select: { userId: true } },
        toMember: { select: { userId: true } },
      },
    });

    if (!settlement) {
      throw new NotFoundException('Thanh toán không tồn tại');
    }

    if (settlement.status === SettlementStatus.CONFIRMED) {
      throw new BadRequestException('Không thể xoá thanh toán đã được xác nhận');
    }

    // Payer, recipient, or organizer can delete a PENDING settlement
    const isPayer = settlement.fromMember.userId === callerId;
    const isRecipient = settlement.toMember.userId === callerId;
    const isOrganizer = callerMember.role === MemberRole.ORGANIZER;
    if (!isPayer && !isRecipient && !isOrganizer) {
      throw new ForbiddenException('Chỉ người trả tiền, người nhận hoặc ban tổ chức mới có thể xoá thanh toán');
    }

    await this.prisma.settlement.delete({ where: { id: settlementId } });
  }
}
