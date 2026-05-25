import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, MemberRole, MemberStatus, SplitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async getExpenses(eventId: string, callerId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        members: {
          where: { userId: callerId, removedAt: null, status: MemberStatus.ACTIVE },
          select: { id: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.members.length === 0) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    return this.prisma.expense.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
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
  }

  async deleteExpense(eventId: string, expenseId: string, callerId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        status: true,
        members: {
          where: { userId: callerId, removedAt: null, status: MemberStatus.ACTIVE },
          select: { id: true, role: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.status === EventStatus.SETTLED || event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Không thể xoá chi phí trong sự kiện đã kết thúc');
    }

    const callerMember = event.members[0];
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, eventId, deletedAt: null },
      select: { id: true, paidById: true },
    });

    if (!expense) {
      throw new NotFoundException('Chi phí không tồn tại');
    }

    const isOrganizer = callerMember.role === MemberRole.ORGANIZER;
    const isCreator = expense.paidById === callerMember.id;
    if (!isOrganizer && !isCreator) {
      throw new ForbiddenException('Chỉ người tạo hoặc ban tổ chức mới có thể xoá chi phí');
    }

    await this.prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date() },
    });
  }

  async updateExpense(eventId: string, expenseId: string, callerId: string, dto: UpdateExpenseDto) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        organizerId: true,
        status: true,
        members: {
          where: { removedAt: null, status: MemberStatus.ACTIVE },
          select: { id: true, userId: true, role: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    if (event.status === EventStatus.SETTLED || event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Không thể chỉnh sửa chi phí trong sự kiện đã kết thúc');
    }

    const callerMember = event.members.find((m) => m.userId === callerId);
    if (!callerMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, eventId, deletedAt: null },
      include: { splits: { select: { memberId: true, amount: true } } },
    });

    if (!expense) {
      throw new NotFoundException('Chi phí không tồn tại');
    }

    const isOrganizer = callerMember.role === MemberRole.ORGANIZER;
    const isCreator = expense.paidById === callerMember.id;
    if (!isOrganizer && !isCreator) {
      throw new ForbiddenException('Chỉ người tạo hoặc ban tổ chức mới có thể chỉnh sửa chi phí');
    }

    const activeMemberIds = new Set(event.members.map((m) => m.id));

    // Determine if splits need to be rebuilt
    const rebuildSplits =
      dto.amount !== undefined ||
      dto.splitType !== undefined ||
      dto.memberIds !== undefined ||
      dto.splits !== undefined;

    const finalAmount = dto.amount ?? expense.amount;
    const finalSplitType = dto.splitType ?? expense.splitType;

    let newSplits: { memberId: string; amount: number }[] | undefined;

    if (rebuildSplits) {
      if (finalSplitType === SplitType.EQUAL) {
        const targetIds = dto.memberIds ?? expense.splits.map((s) => s.memberId);
        const invalidIds = targetIds.filter((id) => !activeMemberIds.has(id));
        if (invalidIds.length > 0) {
          throw new BadRequestException('Một số thành viên không thuộc sự kiện này');
        }
        if (targetIds.length === 0) {
          throw new BadRequestException('Cần ít nhất một thành viên để chia chi phí');
        }
        newSplits = computeEqualSplits(finalAmount, targetIds);
      } else {
        const splitsPayload = dto.splits ?? expense.splits;
        if (!splitsPayload || splitsPayload.length === 0) {
          throw new BadRequestException('Cần cung cấp danh sách phân chia chi phí cho chế độ tuỳ chỉnh');
        }
        const invalidIds = splitsPayload.filter((s) => !activeMemberIds.has(s.memberId));
        if (invalidIds.length > 0) {
          throw new BadRequestException('Một số thành viên trong danh sách phân chia không thuộc sự kiện này');
        }
        const total = splitsPayload.reduce((sum, s) => sum + s.amount, 0);
        if (total !== finalAmount) {
          throw new BadRequestException(
            `Tổng tiền phân chia (${total} ₫) không khớp với số tiền chi phí (${finalAmount} ₫)`,
          );
        }
        newSplits = splitsPayload;
      }
    }

    if (dto.paidById !== undefined) {
      const validPayer = event.members.find((m) => m.id === dto.paidById);
      if (!validPayer) {
        throw new BadRequestException('Người thanh toán không phải thành viên của sự kiện');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (newSplits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expenseSplit.createMany({
          data: newSplits.map((s) => ({ expenseId, memberId: s.memberId, amount: s.amount })),
        });
      }

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          ...(dto.paidById !== undefined && { paidById: dto.paidById }),
          ...(dto.amount !== undefined && { amount: dto.amount }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
          ...(dto.splitType !== undefined && { splitType: dto.splitType }),
        },
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
