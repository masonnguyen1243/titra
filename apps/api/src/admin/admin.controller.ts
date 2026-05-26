import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { PaginateDto } from './dto/paginate.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @HttpCode(HttpStatus.OK)
  getUsers(@Query() query: PaginateDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id')
  @HttpCode(HttpStatus.OK)
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Get('events')
  @HttpCode(HttpStatus.OK)
  getEvents(@Query() query: PaginateDto) {
    return this.adminService.getEvents(query);
  }

  @Patch('events/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveEvent(@Param('id') id: string) {
    return this.adminService.archiveEvent(id);
  }
}
