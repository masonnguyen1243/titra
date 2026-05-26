import { SettlementMethod } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  @IsNotEmpty()
  fromMemberId!: string;

  @IsString()
  @IsNotEmpty()
  toMemberId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(SettlementMethod)
  @IsOptional()
  method?: SettlementMethod;

  @IsUrl()
  @IsOptional()
  proofUrl?: string;
}
