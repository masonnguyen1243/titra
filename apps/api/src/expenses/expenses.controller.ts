import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('events/:eventId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

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
