import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Get('my-history')
  async getMyPointsHistory(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.pointsService.getUserPointsHistory(user.id, page, pageSize);
  }

  @Get('user/:userId')
  async getUserPointsHistory(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.pointsService.getUserPointsHistory(userId, page, pageSize);
  }

  @Post('activity/:activityId/distribute')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async distributePoints(@Param('activityId') activityId: string) {
    return this.pointsService.calculateAndDistributePoints(activityId);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('type') type: 'mileage' | 'rides' | 'score' = 'mileage',
    @Query('limit') limit?: number,
  ) {
    return this.pointsService.getLeaderboard(type, limit);
  }
}
