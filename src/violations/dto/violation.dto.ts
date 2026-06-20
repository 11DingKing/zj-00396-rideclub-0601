import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ViolationType } from '@prisma/client';

export class CreateViolationDto {
  @IsEnum(ViolationType)
  type: ViolationType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  pointsDeducted?: number;
}
