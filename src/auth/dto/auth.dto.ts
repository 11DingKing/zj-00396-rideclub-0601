import { IsString, IsPhoneNumber, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsPhoneNumber('CN')
  phone: string;

  @IsString()
  password: string;

  @IsString()
  nickname: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @IsPhoneNumber('CN')
  phone: string;

  @IsString()
  password: string;
}
