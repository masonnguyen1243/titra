import { Module } from '@nestjs/common';
import { BalanceService } from '../expenses/balance.service';
import { UploadModule } from '../upload/upload.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [UploadModule],
  controllers: [ExportController],
  providers: [ExportService, BalanceService],
})
export class ExportModule {}
