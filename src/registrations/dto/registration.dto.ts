import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
} from "class-validator";
import { BikeType, SpeedLevel } from "@prisma/client";

export class CreateRegistrationDto {
  @IsEnum(BikeType)
  bikeType: BikeType;

  @IsBoolean()
  hasInsurance: boolean;

  @IsDateString()
  @IsOptional()
  insuranceExpiry?: string;

  @IsString()
  emergencyContactName: string;

  @IsString()
  emergencyContactPhone: string;

  @IsString()
  recentRideCapacity: string;

  @IsBoolean()
  @IsOptional()
  hasHelmet?: boolean;

  @IsBoolean()
  @IsOptional()
  hasLights?: boolean;

  @IsEnum(SpeedLevel)
  @IsOptional()
  selfReportedSpeed?: SpeedLevel;
}

export class OptOutDto {
  @IsString()
  reason: string;
}

export class MarkPresenceDto {
  @IsBoolean()
  isPresent: boolean;
}
