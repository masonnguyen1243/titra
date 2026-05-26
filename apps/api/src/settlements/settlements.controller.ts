import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementsService } from './settlements.service';

@Controller('events/:eventId/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createSettlement(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlementsService.createSettlement(eventId, user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getSettlements(@Param('eventId') eventId: string, @CurrentUser() user: JwtPayload) {
    return this.settlementsService.getSettlements(eventId, user.sub);
  }

  @Patch(':settlementId/confirm')
  @HttpCode(HttpStatus.OK)
  confirmSettlement(
    @Param('eventId') eventId: string,
    @Param('settlementId') settlementId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlementsService.confirmSettlement(eventId, settlementId, user.sub);
  }

  @Delete(':settlementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSettlement(
    @Param('eventId') eventId: string,
    @Param('settlementId') settlementId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.settlementsService.deleteSettlement(eventId, settlementId, user.sub);
  }
}
