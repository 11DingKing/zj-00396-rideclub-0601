import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { GroupsService } from "./groups.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import {
  CreateGroupDto,
  UpdateGroupDto,
  AssignRidersDto,
  AutoAssignDto,
  GroupBroadcastDto,
  UpdateGroupRoleDto,
} from "./dto/group.dto";

@Controller("activities/:activityId/groups")
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(
    @Param("activityId") activityId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(activityId, user.id, dto);
  }

  @Get()
  findByActivity(
    @Param("activityId") activityId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.findByActivity(activityId, user.id);
  }

  @Post("auto-assign")
  autoAssign(
    @Param("activityId") activityId: string,
    @CurrentUser() user: any,
    @Body() dto: AutoAssignDto,
  ) {
    return this.groupsService.autoAssign(activityId, user.id, dto);
  }

  @Get(":groupId")
  findOne(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.findOne(groupId, user.id);
  }

  @Put(":groupId")
  update(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(groupId, user.id, dto);
  }

  @Delete(":groupId")
  remove(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.remove(groupId, user.id);
  }

  @Post(":groupId/riders")
  assignRiders(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
    @Body() dto: AssignRidersDto,
  ) {
    return this.groupsService.assignRiders(groupId, user.id, dto);
  }

  @Delete(":groupId/riders/:registrationId")
  removeRider(
    @Param("groupId") groupId: string,
    @Param("registrationId") registrationId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.removeRider(groupId, registrationId, user.id);
  }

  @Put(":groupId/riders/:registrationId/role")
  updateRiderRole(
    @Param("groupId") groupId: string,
    @Param("registrationId") registrationId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGroupRoleDto,
  ) {
    return this.groupsService.updateRiderRole(groupId, registrationId, user.id, dto);
  }

  @Post(":groupId/broadcast")
  sendBroadcast(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
    @Body() dto: GroupBroadcastDto,
  ) {
    return this.groupsService.sendBroadcast(groupId, user.id, dto);
  }

  @Get(":groupId/checkpoints/:checkpointId/stats")
  getGroupCheckpointStats(
    @Param("groupId") groupId: string,
    @Param("checkpointId") checkpointId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.getGroupCheckpointStats(groupId, checkpointId, user.id);
  }

  @Get(":groupId/risk-analysis")
  getGroupRiskAnalysis(
    @Param("groupId") groupId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.getGroupRiskAnalysis(groupId, user.id);
  }
}
