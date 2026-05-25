import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { EventsService } from './events.service';

@Controller('join')
export class JoinController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':token')
  @Public()
  @HttpCode(HttpStatus.OK)
  resolveEvent(@Param('token') token: string) {
    return this.eventsService.resolveEventByInviteToken(token);
  }

  @Post(':token')
  @HttpCode(HttpStatus.CREATED)
  joinEvent(@Param('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.joinByEventToken(token, user.sub);
  }
}
