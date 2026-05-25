import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { JoinEventDto } from './dto/join-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getEvents(@CurrentUser() user: JwtPayload) {
    return this.eventsService.getEvents(user.sub);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getEventDetail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.getEventDetail(id, user.sub);
  }

  @Get(':id/invite')
  @HttpCode(HttpStatus.OK)
  getInvite(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.getInvite(id, user.sub);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.removeMember(id, user.sub, memberId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddMemberDto,
  ) {
    return this.eventsService.addMember(id, user.sub, dto);
  }

  @Post(':id/invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  acceptInvitation(
    @Param('id') id: string,
    @Param('token') token: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eventsService.acceptInvitation(id, user.sub, token);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  joinEvent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: JoinEventDto,
  ) {
    return this.eventsService.joinEvent(id, user.sub, dto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  updateEvent(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvent(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eventsService.deleteEvent(id, user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createEvent(@CurrentUser() user: JwtPayload, @Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(user.sub, dto);
  }
}
