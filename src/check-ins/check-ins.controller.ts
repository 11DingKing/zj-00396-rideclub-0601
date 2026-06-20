import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CheckInsService } from './check-ins.service';
import {
  CreateCheckInDto,
  MissCheckInDto,
  UpdateCheckInStatusDto,
} from './dto/check-in.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('check-ins')
@UseGuards(JwtAuthGuard)
export class CheckInsController {
  constructor(private checkInsService: CheckInsService) {}

  @Post('checkpoint/:checkpointId')
  async checkIn(
    @Param('checkpointId') checkpointId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateCheckInDto,
  ) {
    return this.checkInsService.checkIn(checkpointId, user.id, dto);
  }

  @Get('activity/:activityId')
  async getActivityCheckIns(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.checkInsService.getActivityCheckIns(activityId, user.id);
  }

  @Get('activity/:activityId/my')
  async getMyCheckIns(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.checkInsService.getMyCheckIns(activityId, user.id);
  }

  @Get('checkpoint/:checkpointId/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getCheckpointStatus(
    @Param('checkpointId') checkpointId: string,
    @CurrentUser() user: User,
  ) {
    return this.checkInsService.getCheckpointStatus(checkpointId, user.id);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCheckInStatusDto,
  ) {
    return this.checkInsService.updateStatus(id, user.id, dto);
  }

  @Post(':id/miss')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async markMissed(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: MissCheckInDto,
  ) {
    return this.checkInsService.markMissed(id, user.id, dto);
  }

  @Post('activity/:activityId/bulk-create')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async bulkCreatePending(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.checkInsService.bulkCreatePendingCheckIns(activityId, user.id);
  }
}
