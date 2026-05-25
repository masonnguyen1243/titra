import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { CreateEventDto } from './dto/create-event.dto';
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
