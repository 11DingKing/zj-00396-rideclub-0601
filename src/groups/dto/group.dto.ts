import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpeedLevel, RouteLevel, GroupRole } from '@prisma/client';

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsEnum(SpeedLevel)
  speedLevel: SpeedLevel;

  @IsEnum(RouteLevel)
  minExperience: RouteLevel;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  orderIndex: number;

  @IsString()
  @IsOptional()
  leaderId?: string;

  @IsString()
  @IsOptional()
  sweeperId?: string;
}

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(SpeedLevel)
  @IsOptional()
  speedLevel?: SpeedLevel;

  @IsEnum(RouteLevel)
  @IsOptional()
  minExperience?: RouteLevel;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  orderIndex?: number;

  @IsString()
  @IsOptional()
  leaderId?: string;

  @IsString()
  @IsOptional()
  sweeperId?: string;
}

export class AssignRiderDto {
  @IsString()
  registrationId: string;

  @IsEnum(GroupRole)
  @IsOptional()
  groupRole?: GroupRole;
}

export class AssignRidersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignRiderDto)
  assignments: AssignRiderDto[];
}

export class AutoAssignDto {
  @IsBoolean()
  @IsOptional()
  bySpeed?: boolean;

  @IsBoolean()
  @IsOptional()
  byExperience?: boolean;

  @IsInt()
  @IsOptional()
  minGroupSize?: number;

  @IsInt()
  @IsOptional()
  maxGroupSize?: number;
}

export class GroupBroadcastDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateGroupRoleDto {
  @IsEnum(GroupRole)
  role: GroupRole;
}
