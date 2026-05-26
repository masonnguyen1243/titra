import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { SendReminderDto } from './dto/send-reminder.dto';
import { NotificationsService } from './notifications.service';

@Controller('events/:eventId/reminders')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  sendReminder(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendReminderDto,
  ) {
    return this.notificationsService.sendReminder(eventId, user.sub, dto);
  }
}
