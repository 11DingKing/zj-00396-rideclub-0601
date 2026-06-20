import {
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RouteLevel, CheckpointType } from '@prisma/client';

class CheckpointDto {
  @IsString()
  name: string;

  @IsEnum(CheckpointType)
  type: CheckpointType;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsInt()
  orderIndex: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  expectedTime?: string;
}

export class CreateActivityDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RouteLevel)
  routeLevel: RouteLevel;

  @IsString()
  meetingPoint: string;

  @IsNumber()
  @IsOptional()
  meetingLat?: number;

  @IsNumber()
  @IsOptional()
  meetingLng?: number;

  @IsDateString()
  startAt: string;

  @IsNumber()
  estimatedMileage: number;

  @IsInt()
  estimatedElevation: number;

  @IsInt()
  maxParticipants: number;

  @IsObject()
  requiredEquipment: any;

  @IsBoolean()
  @IsOptional()
  isNightRide?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckpointDto)
  checkpoints: CheckpointDto[];
}

export class UpdateActivityDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RouteLevel)
  @IsOptional()
  routeLevel?: RouteLevel;

  @IsString()
  @IsOptional()
  meetingPoint?: string;

  @IsNumber()
  @IsOptional()
  meetingLat?: number;

  @IsNumber()
  @IsOptional()
  meetingLng?: number;

  @IsDateString()
  @IsOptional()
  startAt?: string;

  @IsNumber()
  @IsOptional()
  estimatedMileage?: number;

  @IsInt()
  @IsOptional()
  estimatedElevation?: number;

  @IsInt()
  @IsOptional()
  maxParticipants?: number;

  @IsObject()
  @IsOptional()
  requiredEquipment?: any;

  @IsBoolean()
  @IsOptional()
  isNightRide?: boolean;
}

export class CreateEventDto {
  @IsEnum(['WEATHER_WARNING', 'ROAD_CONSTRUCTION', 'ACCIDENT', 'ROUTE_CHANGE', 'PAUSE', 'RESUME', 'EARLY_FINISH'])
  type: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  newRoute?: any;
}

export class ChangeRouteDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckpointDto)
  checkpoints: CheckpointDto[];
}
