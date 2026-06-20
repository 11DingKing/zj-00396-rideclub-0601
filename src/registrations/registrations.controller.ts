import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  OptOutDto,
  MarkPresenceDto,
} from './dto/registration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '@prisma/client';

@Controller('registrations')
@UseGuards(JwtAuthGuard)
export class RegistrationsController {
  constructor(private registrationsService: RegistrationsService) {}

  @Post('activity/:activityId')
  async register(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.registrationsService.create(activityId, user.id, dto);
  }

  @Get('my')
  async getMyRegistrations(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.registrationsService.findMyRegistrations(user.id, page, pageSize);
  }

  @Get('activity/:activityId')
  async getByActivity(
    @Param('activityId') activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.registrationsService.findByActivity(activityId, user.id);
  }

  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.registrationsService.getRegistrationDetail(id, user.id);
  }

  @Delete(':id')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.registrationsService.cancel(id, user.id);
  }

  @Post(':id/opt-out')
  async optOut(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: OptOutDto,
  ) {
    return this.registrationsService.optOut(id, user.id, dto);
  }

  @Put(':id/presence')
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async markPresence(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: MarkPresenceDto,
  ) {
    return this.registrationsService.markPresence(id, user.id, dto);
  }
}
