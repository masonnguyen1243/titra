import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { InvitationsController } from './invitations.controller';
import { JoinController } from './join.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController, JoinController, InvitationsController],
  providers: [EventsService],
})
export class EventsModule {}
