import { Controller, ForbiddenException, Get, HttpCode, HttpStatus, NotFoundException, Param } from '@nestjs/common';
import { MemberStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceService, MemberBalance } from './balance.service';

@Controller('events/:eventId/balances')
export class BalancesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getBalances(@Param('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        members: {
          where: { removedAt: null, status: MemberStatus.ACTIVE },
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
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Sự kiện không tồn tại');
    }

    const isMember = event.members.some((m) => m.userId === user.sub);
    if (!isMember) {
      throw new ForbiddenException('Bạn không phải thành viên của sự kiện này');
    }

    const memberBalances: MemberBalance[] = event.members.map((m) => {
      const totalPaid = m.paidExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalOwed = m.expenseSplits.reduce((sum, s) => sum + s.amount, 0);
      return {
        memberId: m.id,
        nickname: m.nickname,
        userId: m.userId,
        net: totalPaid - totalOwed,
      };
    });

    return this.balanceService.compute(memberBalances);
  }
}
