import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { EventsService } from './events.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.acceptInvitationByMemberToken(token, user.sub);
  }
}
