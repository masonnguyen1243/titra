import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, SplitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(eventId: string, callerId: string, dto: CreateExpenseDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        status: true,
        members: {
          where: { removedAt: null, status: MemberStatus.ACTIVE },
          select: { id: true, userId: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const callerMember = event.members.find((m) => m.userId === callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const paidByMember = event.members.find((m) => m.id === dto.paidById);
    if (!paidByMember) {
      throw new BadRequestException('Người thanh toán không phải thành viên của sự kiện');
    }

    const activeMemberIds = new Set(event.members.map((m) => m.id));

    let splits: { memberId: string; amount: number }[];

    if (dto.splitType === SplitType.EQUAL) {
      const targetIds = dto.memberIds ?? [...activeMemberIds];

      const invalidIds = targetIds.filter((id) => !activeMemberIds.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException('Một số thành viên không thuộc sự kiện này');
      }

      if (targetIds.length === 0) {
        throw new BadRequestException('Cần ít nhất một thành viên để chia chi phí');
      }

      splits = computeEqualSplits(dto.amount, targetIds);
    } else {
      if (!dto.splits || dto.splits.length === 0) {
        throw new BadRequestException('Cần cung cấp danh sách phân chia chi phí cho chế độ tuỳ chỉnh');
      }

      const invalidIds = dto.splits.filter((s) => !activeMemberIds.has(s.memberId));
      if (invalidIds.length > 0) {
        throw new BadRequestException('Một số thành viên trong danh sách phân chia không thuộc sự kiện này');
      }

      const total = dto.splits.reduce((sum, s) => sum + s.amount, 0);
      if (total !== dto.amount) {
        throw new BadRequestException(
          `Tổng tiền phân chia (${total} ₫) không khớp với số tiền chi phí (${dto.amount} ₫)`,
        );
      }

      splits = dto.splits;
    }

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          eventId,
          paidById: dto.paidById,
          amount: dto.amount,
          description: dto.description,
          category: dto.category,
          receiptUrl: dto.receiptUrl,
          splitType: dto.splitType,
        },
      });

      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: expense.id,
          memberId: s.memberId,
          amount: s.amount,
        })),
      });

      return tx.expense.findUnique({
        where: { id: expense.id },
        include: {
          paidBy: { select: { id: true, nickname: true, userId: true } },
          splits: {
            select: {
              id: true,
              memberId: true,
              amount: true,
              member: { select: { nickname: true, userId: true } },
            },
          },
        },
      });
    });
  }
}

function computeEqualSplits(
  total: number,
  memberIds: string[],
): { memberId: string; amount: number }[] {
  const n = memberIds.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;

  return memberIds.map((memberId, i) => ({
    memberId,
    amount: i === 0 ? base + remainder : base,
  }));
}
