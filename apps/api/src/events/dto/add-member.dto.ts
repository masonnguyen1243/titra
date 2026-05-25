import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class AddMemberDto {
  @IsOptional()
  @IsEmail({}, { message: 'email phải là địa chỉ email hợp lệ' })
  email?: string;

  // name is required only when email is absent
  @ValidateIf((o: AddMemberDto) => !o.email)
  @IsString()
  @IsNotEmpty({ message: 'name không được để trống khi không cung cấp email' })
  @MaxLength(100)
  name?: string;
}
