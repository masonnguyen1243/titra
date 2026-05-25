import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('events/:eventId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getExpenses(@Param('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.expensesService.getExpenses(eventId, user.sub);
  }

  @Patch(':expenseId')
  @HttpCode(HttpStatus.OK)
  updateExpense(
    @Param('eventId') eventId: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expensesService.updateExpense(eventId, expenseId, user.sub, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createExpense(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expensesService.createExpense(eventId, user.sub, dto);
  }
}
