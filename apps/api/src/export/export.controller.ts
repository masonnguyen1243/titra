import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { ExportService } from './export.service';

@Controller('events/:eventId/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('pdf')
  @HttpCode(HttpStatus.OK)
  async exportPdf(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ url: string }> {
    return this.exportService.exportEventPdf(eventId, user.sub);
  }
}
