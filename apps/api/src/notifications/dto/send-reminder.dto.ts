import { IsNotEmpty, IsString } from 'class-validator';

export class SendReminderDto {
  @IsString()
  @IsNotEmpty()
  memberId!: string;
}
