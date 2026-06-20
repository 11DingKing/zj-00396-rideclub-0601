import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { CheckInStatus } from '@prisma/client';

export class CreateCheckInDto {
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}

export class MissCheckInDto {
  @IsString()
  reason: string;
}

export class UpdateCheckInStatusDto {
  @IsEnum(CheckInStatus)
  status: CheckInStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
