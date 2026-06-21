import { Controller, Get, Query, UseGuards, Param } from "@nestjs/common";
import { StatisticsService } from "./statistics.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User, UserRole } from "@prisma/client";

@Controller("statistics")
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @Get("overall")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOverallStats() {
    return this.statisticsService.getOverallStats();
  }

  @Get("monthly")
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getMonthlyStats(
    @Query("year") year?: number,
    @Query("month") month?: number,
  ) {
    return this.statisticsService.getMonthlyStats(year, month);
  }

  @Get("route-popularity")
  async getRouteLevelPopularity(@Query("months") months?: number) {
    return this.statisticsService.getRouteLevelPopularity(months);
  }

  @Get("attendance-trend")
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getAttendanceTrend(@Query("months") months?: number) {
    return this.statisticsService.getAttendanceTrend(months);
  }

  @Get("my-leader-stats")
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getMyLeaderStats(@CurrentUser() user: User) {
    return this.statisticsService.getLeaderStats(user.id);
  }

  @Get("leader/:leaderId")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getLeaderStats(@Param("leaderId") leaderId: string) {
    return this.statisticsService.getLeaderStats(leaderId);
  }

  @Get("activities/:activityId/group-analysis")
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getActivityGroupAnalysis(
    @Param("activityId") activityId: string,
    @CurrentUser() user: User,
  ) {
    return this.statisticsService.getActivityGroupAnalysis(activityId, user.id);
  }

  @Get("group-risk-trend")
  @UseGuards(RolesGuard)
  @Roles(UserRole.LEADER, UserRole.ADMIN)
  async getHistoricalGroupRiskTrend(
    @CurrentUser() user: User,
    @Query("months") months?: number,
  ) {
    return this.statisticsService.getHistoricalGroupRiskTrend(user.id, months);
  }
}
