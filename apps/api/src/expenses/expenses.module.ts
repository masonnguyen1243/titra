import { Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { BalancesController } from './balances.controller';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  controllers: [ExpensesController, BalancesController],
  providers: [ExpensesService, BalanceService],
  exports: [BalanceService],
})
export class ExpensesModule {}
