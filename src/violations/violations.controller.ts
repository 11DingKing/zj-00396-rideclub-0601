import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { CreateViolationDto } from './dto/violation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('violations')
@UseGuards(JwtAuthGuard)
export class ViolationsController {
  constructor(private violationsService: ViolationsService) {}

  @Post('activity/:activityId/rider/:riderId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async create(
    @Param('activityId') activityId: string,
    @Param('riderId') riderId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateViolationDto,
  ) {
    return this.violationsService.create(activityId, riderId, user.id, dto);
  }

  @Get('activity/:activityId')
  async getByActivity(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.violationsService.findByActivity(activityId, user.id);
  }

  @Get('my')
  async getMyViolations(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.violationsService.findByRider(user.id, page, pageSize);
  }

  @Get('rider/:riderId')
  async getByRider(
    @Param('riderId') riderId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.violationsService.findByRider(riderId, page, pageSize);
  }

  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.violationsService.findOne(id, user.id);
  }

  @Post('activity/:activityId/check-equipment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async checkNightRideEquipment(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.violationsService.checkNightRideEquipment(activityId, user.id);
  }

  @Post('activity/:activityId/auto-record-missed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async autoRecordMissedCheckpoints(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.violationsService.autoRecordMissedCheckpoints(activityId, user.id);
  }
}
