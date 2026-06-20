import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  CreateEventDto,
  ChangeRouteDto,
} from './dto/create-activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole, ActivityStatus } from '@prisma/client';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activitiesService.create(user.id, dto);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: ActivityStatus,
    @Query('level') level?: string,
  ) {
    return this.activitiesService.findAll(page, pageSize, status, level);
  }

  @Get('my-led')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getMyLedActivities(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.activitiesService.getMyLedActivities(user.id, page, pageSize);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, user.id, dto);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async publish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.activitiesService.publish(id, user.id);
  }

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async start(@Param('id') id: string, @CurrentUser() user: User) {
    return this.activitiesService.start(id, user.id);
  }

  @Post(':id/pause')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async pause(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.activitiesService.pause(id, user.id, reason);
  }

  @Post(':id/resume')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async resume(@Param('id') id: string, @CurrentUser() user: User) {
    return this.activitiesService.resume(id, user.id);
  }

  @Post(':id/finish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async finish(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('actualMileage') actualMileage?: number,
  ) {
    return this.activitiesService.finish(id, user.id, actualMileage);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.activitiesService.cancel(id, user.id, reason);
  }

  @Post(':id/change-route')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async changeRoute(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ChangeRouteDto,
  ) {
    return this.activitiesService.changeRoute(id, user.id, dto);
  }

  @Post(':id/events')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async addEvent(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: CreateEventDto,
  ) {
    return this.activitiesService.addEvent(id, user.id, dto);
  }
}
