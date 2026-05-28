import { ExpenseCategory, SplitType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SplitItemDto } from './create-expense.dto';

export class UpdateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  paidById?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  description?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @ValidateIf((o: UpdateExpenseDto) => o.receiptUrl !== null)
  @IsUrl()
  @IsOptional()
  receiptUrl?: string | null;

  @IsEnum(SplitType)
  @IsOptional()
  splitType?: SplitType;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  memberIds?: string[];

  // Required when splitType is being set to CUSTOM and splits are not already stored
  @ValidateIf((o: UpdateExpenseDto) => o.splitType === SplitType.CUSTOM)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  @IsOptional()
  splits?: SplitItemDto[];
}
