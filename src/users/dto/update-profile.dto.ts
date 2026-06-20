import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { BikeType } from '@prisma/client';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  realName?: string;

  @IsString()
  @IsOptional()
  idCard?: string;

  @IsEnum(BikeType)
  @IsOptional()
  bikeType?: BikeType;

  @IsString()
  @IsOptional()
  bikeBrand?: string;

  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  recentRideCapacity?: string;
}
