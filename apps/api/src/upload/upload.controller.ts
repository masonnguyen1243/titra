import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CloudinaryService } from './cloudinary.service';

class SignQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  folder?: string;
}

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Get('sign')
  @HttpCode(HttpStatus.OK)
  sign(@Query() query: SignQueryDto) {
    const folder = query.folder ?? 'receipts';
    return this.cloudinaryService.generateSignedUploadParams(folder);
  }
}
