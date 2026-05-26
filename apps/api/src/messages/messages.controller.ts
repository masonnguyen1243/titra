import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { GetMessagesDto } from './dto/get-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';

@Controller('events/:eventId/messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get()
  getMessages(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: GetMessagesDto,
  ) {
    return this.messagesService.getMessages(eventId, user.sub, query.cursor, query.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messagesService.createMessage(eventId, user.sub, dto.content);
    this.messagesGateway.broadcastMessage(eventId, message);
    return message;
  }
}
