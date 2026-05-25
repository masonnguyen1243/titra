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

export class SplitItemDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @IsInt()
  @Min(0)
  amount!: number;
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  paidById!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsUrl()
  @IsOptional()
  receiptUrl?: string;

  @IsEnum(SplitType)
  splitType!: SplitType;

  // EQUAL mode: optional list of member IDs to split among (defaults to all ACTIVE members)
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  memberIds?: string[];

  // CUSTOM mode: required array of {memberId, amount} that must sum to total amount
  @ValidateIf((o: CreateExpenseDto) => o.splitType === SplitType.CUSTOM)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitItemDto)
  splits?: SplitItemDto[];
}
