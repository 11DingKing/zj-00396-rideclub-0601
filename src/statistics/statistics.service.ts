import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ActivityStatus,
  RouteLevel,
  CheckpointType,
  CheckInStatus,
} from "@prisma/client";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getMonthlyStats(year?: number, month?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth();

    const monthStart = startOfMonth(new Date(targetYear, targetMonth, 1));
    const monthEnd = endOfMonth(monthStart);

    const activities = await this.prisma.activity.findMany({
      where: {
        startAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        checkpoints: true,
        registrations: {
          where: { cancelledAt: null },
          include: {
            checkIns: {
              include: { checkpoint: true },
            },
          },
        },
      },
    });

    const completedActivities = activities.filter(
      (a) => a.status === ActivityStatus.COMPLETED,
    );

    const totalRegistrations = activities.reduce(
      (sum, a) => sum + a.registrations.length,
      0,
    );

    const totalPresent = activities.reduce((sum, a) => {
      return (
        sum +
        a.registrations.filter((r) =>
          r.checkIns.some(
            (ci) =>
              ci.checkpoint.type === CheckpointType.START &&
              ci.status === CheckInStatus.CHECKED_IN,
          ),
        ).length
      );
    }, 0);

    const totalCompleted = completedActivities.reduce((sum, a) => {
      return sum + a.registrations.filter((r) => r.completed).length;
    }, 0);

    const completionRate =
      activities.length > 0
        ? Math.round((completedActivities.length / activities.length) * 100)
        : 0;

    const attendanceRate =
      totalRegistrations > 0
        ? Math.round((totalPresent / totalRegistrations) * 100)
        : 0;

    const routeLevelStats: Record<
      string,
      { count: number; participants: number }
    > = {};

    for (const activity of activities) {
      const level = activity.routeLevel;
      if (!routeLevelStats[level]) {
        routeLevelStats[level] = { count: 0, participants: 0 };
      }
      routeLevelStats[level].count++;
      routeLevelStats[level].participants += activity.registrations.length;
    }

    return {
      period: {
        year: targetYear,
        month: targetMonth + 1,
        startDate: monthStart,
        endDate: monthEnd,
      },
      metrics: {
        totalActivities: activities.length,
        completedActivities: completedActivities.length,
        cancelledActivities: activities.filter(
          (a) => a.status === ActivityStatus.CANCELLED,
        ).length,
        totalRegistrations,
        totalPresent,
        totalCompleted,
        completionRate,
        attendanceRate,
        avgParticipantsPerActivity:
          activities.length > 0
            ? Math.round(totalRegistrations / activities.length)
            : 0,
      },
      routeLevelStats,
      topActivities: activities
        .sort((a, b) => b.registrations.length - a.registrations.length)
        .slice(0, 5)
        .map((a) => ({
          id: a.id,
          title: a.title,
          routeLevel: a.routeLevel,
          participants: a.registrations.length,
          status: a.status,
        })),
    };
  }

  async getRouteLevelPopularity(months: number = 6) {
    const now = new Date();
    const startDate = subMonths(now, months);

    const activities = await this.prisma.activity.findMany({
      where: {
        startAt: {
          gte: startDate,
        },
        status: {
          not: ActivityStatus.CANCELLED,
        },
      },
      include: {
        registrations: {
          where: { cancelledAt: null },
        },
      },
    });

    const levelStats: Record<string, any> = {};

    for (const level of Object.values(RouteLevel)) {
      levelStats[level] = {
        routeLevel: level,
        activitiesCount: 0,
        totalParticipants: 0,
        avgParticipants: 0,
        completionRate: 0,
        totalMileage: 0,
      };
    }

    for (const activity of activities) {
      const stat = levelStats[activity.routeLevel];
      stat.activitiesCount++;
      stat.totalParticipants += activity.registrations.length;
      stat.totalMileage += activity.estimatedMileage;

      if (activity.status === ActivityStatus.COMPLETED) {
        const completedCount = activity.registrations.filter(
          (r) => r.completed,
        ).length;
        if (activity.registrations.length > 0) {
          stat.completionRate +=
            (completedCount / activity.registrations.length) * 100;
        }
      }
    }

    for (const level of Object.keys(levelStats)) {
      const stat = levelStats[level];
      if (stat.activitiesCount > 0) {
        stat.avgParticipants = Math.round(
          stat.totalParticipants / stat.activitiesCount,
        );
        stat.completionRate = Math.round(
          stat.completionRate / stat.activitiesCount,
        );
      }
    }

    return Object.values(levelStats).sort(
      (a, b) => b.totalParticipants - a.totalParticipants,
    );
  }

  async getAttendanceTrend(months: number = 6) {
    const trend: Array<{
      year: number;
      month: number;
      totalRegistrations: number;
      presentCount: number;
      completedCount: number;
      attendanceRate: number;
      completionRate: number;
    }> = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const registrations = await this.prisma.registration.findMany({
        where: {
          registeredAt: {
            gte: monthStart,
            lte: monthEnd,
          },
          cancelledAt: null,
        },
        include: {
          activity: {
            select: { status: true },
          },
          checkIns: {
            include: { checkpoint: true },
          },
        },
      });

      const presentCount = registrations.filter((r) =>
        r.checkIns.some(
          (ci) =>
            ci.checkpoint.type === CheckpointType.START &&
            ci.status === CheckInStatus.CHECKED_IN,
        ),
      ).length;
      const completedCount = registrations.filter(
        (r) => r.completed && r.activity.status === ActivityStatus.COMPLETED,
      ).length;

      trend.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
        totalRegistrations: registrations.length,
        presentCount,
        completedCount,
        attendanceRate:
          registrations.length > 0
            ? Math.round((presentCount / registrations.length) * 100)
            : 0,
        completionRate:
          registrations.length > 0
            ? Math.round((completedCount / registrations.length) * 100)
            : 0,
      });
    }

    return trend;
  }

  async getLeaderStats(leaderId: string) {
    const activities = await this.prisma.activity.findMany({
      where: { leaderId },
      include: {
        registrations: {
          where: { cancelledAt: null },
          include: {
            checkIns: {
              include: { checkpoint: true },
            },
          },
        },
      },
      orderBy: { startAt: "desc" },
    });

    const totalActivities = activities.length;
    const completedActivities = activities.filter(
      (a) => a.status === ActivityStatus.COMPLETED,
    ).length;

    const totalParticipants = activities.reduce(
      (sum, a) => sum + a.registrations.length,
      0,
    );

    const totalPresent = activities.reduce(
      (sum, a) =>
        sum +
        a.registrations.filter((r) =>
          r.checkIns.some(
            (ci) =>
              ci.checkpoint.type === CheckpointType.START &&
              ci.status === CheckInStatus.CHECKED_IN,
          ),
        ).length,
      0,
    );

    const totalCompleted = activities.reduce(
      (sum, a) => sum + a.registrations.filter((r) => r.completed).length,
      0,
    );

    const totalMileage = activities
      .filter((a) => a.status === ActivityStatus.COMPLETED)
      .reduce((sum, a) => sum + (a.actualMileage || a.estimatedMileage), 0);

    const levelDistribution: Record<string, number> = {};
    for (const activity of activities) {
      levelDistribution[activity.routeLevel] =
        (levelDistribution[activity.routeLevel] || 0) + 1;
    }

    return {
      totalActivities,
      completedActivities,
      cancelledActivities: activities.filter(
        (a) => a.status === ActivityStatus.CANCELLED,
      ).length,
      totalParticipants,
      totalPresent,
      totalCompleted,
      totalMileage,
      completionRate:
        totalActivities > 0
          ? Math.round((completedActivities / totalActivities) * 100)
          : 0,
      avgParticipants:
        totalActivities > 0
          ? Math.round(totalParticipants / totalActivities)
          : 0,
      avgAttendanceRate:
        totalParticipants > 0
          ? Math.round((totalPresent / totalParticipants) * 100)
          : 0,
      levelDistribution,
      recentActivities: activities.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        participants: a.registrations.length,
        startAt: a.startAt,
      })),
    };
  }

  async getOverallStats() {
    const [
      totalUsers,
      totalLeaders,
      totalActivities,
      completedActivities,
      totalRegistrations,
      totalMileage,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "LEADER" } }),
      this.prisma.activity.count(),
      this.prisma.activity.count({
        where: { status: ActivityStatus.COMPLETED },
      }),
      this.prisma.registration.count({ where: { cancelledAt: null } }),
      this.prisma.user.aggregate({
        _sum: { totalMileage: true },
      }),
    ]);

    const upcomingActivities = await this.prisma.activity.count({
      where: {
        status: {
          in: [ActivityStatus.PUBLISHED, ActivityStatus.REGISTRATION_CLOSED],
        },
        startAt: {
          gte: new Date(),
        },
      },
    });

    const activeNow = await this.prisma.activity.count({
      where: { status: ActivityStatus.IN_PROGRESS },
    });

    return {
      users: {
        total: totalUsers,
        leaders: totalLeaders,
        riders: totalUsers - totalLeaders,
        totalMileage: totalMileage._sum.totalMileage || 0,
      },
      activities: {
        total: totalActivities,
        completed: completedActivities,
        upcoming: upcomingActivities,
        activeNow,
        completionRate:
          totalActivities > 0
            ? Math.round((completedActivities / totalActivities) * 100)
            : 0,
      },
      registrations: {
        total: totalRegistrations,
      },
    };
  }

  async getActivityGroupAnalysis(activityId: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        groups: {
          orderBy: { orderIndex: "asc" },
          include: {
            leader: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
            sweeper: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
            registrations: {
              where: { cancelledAt: null },
              include: {
                rider: {
                  select: {
                    safetyScore: true,
                    level: true,
                  },
                },
                checkIns: true,
                violations: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      throw new Error("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new Error("只有活动领队可以查看分组分析");
    }

    const groupAnalysis = [];

    for (const group of activity.groups) {
      const totalRiders = group.registrations.length;

      if (totalRiders === 0) {
        groupAnalysis.push({
          groupId: group.id,
          groupName: group.name,
          speedLevel: group.speedLevel,
          minExperience: group.minExperience,
          totalRiders: 0,
          riskScore: 0,
          riskLevel: "LOW",
          leader: group.leader,
          sweeper: group.sweeper,
        });
        continue;
      }

      const totalViolations = group.registrations.reduce(
        (sum, r) => sum + r.violations.length,
        0,
      );
      const totalMissed = group.registrations.reduce(
        (sum, r) =>
          sum +
          r.checkIns.filter((ci) => ci.status === CheckInStatus.MISSED).length,
        0,
      );
      const totalOptOut = group.registrations.filter(
        (r) => r.optOutReason !== null,
      ).length;
      const avgSafetyScore =
        group.registrations.reduce(
          (sum, r) => sum + (r.rider?.safetyScore || 0),
          0,
        ) / totalRiders;
      const avgRiderLevel =
        group.registrations.reduce((sum, r) => sum + (r.rider?.level || 0), 0) /
        totalRiders;

      const totalCheckIns = group.registrations.reduce(
        (sum, r) => sum + r.checkIns.length,
        0,
      );

      const violationRate =
        totalRiders > 0 ? (totalViolations / totalRiders) * 100 : 0;
      const missedRate =
        totalCheckIns > 0 ? (totalMissed / totalCheckIns) * 100 : 0;
      const optOutRate =
        totalRiders > 0 ? (totalOptOut / totalRiders) * 100 : 0;

      let riskScore = 0;
      riskScore += (100 - avgSafetyScore) * 0.4;
      riskScore += violationRate * 2;
      riskScore += missedRate * 1.5;
      riskScore += optOutRate * 2;
      riskScore += (10 - avgRiderLevel) * 2;

      riskScore = Math.min(100, Math.max(0, riskScore));

      let riskLevel = "LOW";
      if (riskScore >= 70) {
        riskLevel = "HIGH";
      } else if (riskScore >= 40) {
        riskLevel = "MEDIUM";
      }

      const highRiskRiders = group.registrations
        .filter(
          (r) => (r.rider?.safetyScore || 100) < 70 || r.violations.length > 0,
        )
        .map((r) => ({
          riderId: r.riderId,
          safetyScore: r.rider?.safetyScore,
          violations: r.violations.length,
          missedCheckpoints: r.checkIns.filter(
            (ci) => ci.status === CheckInStatus.MISSED,
          ).length,
          hasOptOut: !!r.optOutReason,
        }));

      groupAnalysis.push({
        groupId: group.id,
        groupName: group.name,
        speedLevel: group.speedLevel,
        minExperience: group.minExperience,
        totalRiders,
        riskScore: Math.round(riskScore),
        riskLevel,
        leader: group.leader,
        sweeper: group.sweeper,
        metrics: {
          avgSafetyScore: Math.round(avgSafetyScore),
          violationRate: Math.round(violationRate),
          missedCheckpointRate: Math.round(missedRate),
          optOutRate: Math.round(optOutRate),
          avgRiderLevel: Math.round(avgRiderLevel),
          totalViolations,
          totalMissed,
          totalOptOut,
        },
        highRiskRiders,
      });
    }

    const sortedByRisk = [...groupAnalysis].sort(
      (a, b) => b.riskScore - a.riskScore,
    );
    const highestRiskGroup = sortedByRisk[0] || null;

    return {
      activity: {
        id: activity.id,
        title: activity.title,
        status: activity.status,
        startAt: activity.startAt,
      },
      totalGroups: activity.groups.length,
      totalParticipants: activity.groups.reduce(
        (sum, g) => sum + g.registrations.length,
        0,
      ),
      groupAnalysis: sortedByRisk,
      highestRiskGroup,
      summary: {
        highRiskGroups: sortedByRisk.filter((g) => g.riskLevel === "HIGH")
          .length,
        mediumRiskGroups: sortedByRisk.filter((g) => g.riskLevel === "MEDIUM")
          .length,
        lowRiskGroups: sortedByRisk.filter((g) => g.riskLevel === "LOW").length,
      },
    };
  }

  async getHistoricalGroupRiskTrend(leaderId: string, months: number = 6) {
    const now = new Date();
    const startDate = subMonths(now, months);

    const activities = await this.prisma.activity.findMany({
      where: {
        leaderId,
        startAt: {
          gte: startDate,
        },
        status: ActivityStatus.COMPLETED,
      },
      include: {
        groups: {
          include: {
            registrations: {
              where: { cancelledAt: null },
              include: {
                rider: {
                  select: {
                    safetyScore: true,
                    level: true,
                  },
                },
                checkIns: true,
                violations: true,
              },
            },
          },
        },
      },
    });

    const trend: Array<{
      year: number;
      month: number;
      avgRiskScore: number;
      highRiskCount: number;
      mediumRiskCount: number;
      lowRiskCount: number;
      totalGroups: number;
    }> = [];

    const monthlyData: Record<
      string,
      {
        riskScores: number[];
        highRisk: number;
        mediumRisk: number;
        lowRisk: number;
        total: number;
      }
    > = {};

    for (const activity of activities) {
      const monthKey = `${activity.startAt.getFullYear()}-${activity.startAt.getMonth()}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          riskScores: [],
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          total: 0,
        };
      }

      for (const group of activity.groups) {
        const totalRiders = group.registrations.length;
        if (totalRiders === 0) continue;

        const totalViolations = group.registrations.reduce(
          (sum, r) => sum + r.violations.length,
          0,
        );
        const totalMissed = group.registrations.reduce(
          (sum, r) =>
            sum +
            r.checkIns.filter((ci) => ci.status === CheckInStatus.MISSED)
              .length,
          0,
        );
        const totalOptOut = group.registrations.filter(
          (r) => r.optOutReason !== null,
        ).length;
        const avgSafetyScore =
          group.registrations.reduce(
            (sum, r) => sum + (r.rider?.safetyScore || 0),
            0,
          ) / totalRiders;
        const avgRiderLevel =
          group.registrations.reduce(
            (sum, r) => sum + (r.rider?.level || 0),
            0,
          ) / totalRiders;

        const totalCheckIns = group.registrations.reduce(
          (sum, r) => sum + r.checkIns.length,
          0,
        );

        const violationRate =
          totalRiders > 0 ? (totalViolations / totalRiders) * 100 : 0;
        const missedRate =
          totalCheckIns > 0 ? (totalMissed / totalCheckIns) * 100 : 0;
        const optOutRate =
          totalRiders > 0 ? (totalOptOut / totalRiders) * 100 : 0;

        let riskScore = 0;
        riskScore += (100 - avgSafetyScore) * 0.4;
        riskScore += violationRate * 2;
        riskScore += missedRate * 1.5;
        riskScore += optOutRate * 2;
        riskScore += (10 - avgRiderLevel) * 2;

        riskScore = Math.min(100, Math.max(0, riskScore));

        monthlyData[monthKey].riskScores.push(riskScore);
        monthlyData[monthKey].total++;

        if (riskScore >= 70) {
          monthlyData[monthKey].highRisk++;
        } else if (riskScore >= 40) {
          monthlyData[monthKey].mediumRisk++;
        } else {
          monthlyData[monthKey].lowRisk++;
        }
      }
    }

    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      const data = monthlyData[monthKey] || {
        riskScores: [],
        highRisk: 0,
        mediumRisk: 0,
        lowRisk: 0,
        total: 0,
      };

      const avgRiskScore =
        data.riskScores.length > 0
          ? Math.round(
              data.riskScores.reduce((a, b) => a + b, 0) /
                data.riskScores.length,
            )
          : 0;

      trend.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
        avgRiskScore,
        highRiskCount: data.highRisk,
        mediumRiskCount: data.mediumRisk,
        lowRiskCount: data.lowRisk,
        totalGroups: data.total,
      });
    }

    const speedLevelRisk: Record<string, { avgRisk: number; count: number }> =
      {};

    for (const activity of activities) {
      for (const group of activity.groups) {
        if (group.registrations.length === 0) continue;

        const totalRiders = group.registrations.length;
        const totalViolations = group.registrations.reduce(
          (sum, r) => sum + r.violations.length,
          0,
        );
        const totalMissed = group.registrations.reduce(
          (sum, r) =>
            sum +
            r.checkIns.filter((ci) => ci.status === CheckInStatus.MISSED)
              .length,
          0,
        );
        const totalOptOut = group.registrations.filter(
          (r) => r.optOutReason !== null,
        ).length;
        const avgSafetyScore =
          group.registrations.reduce(
            (sum, r) => sum + (r.rider?.safetyScore || 0),
            0,
          ) / totalRiders;
        const avgRiderLevel =
          group.registrations.reduce(
            (sum, r) => sum + (r.rider?.level || 0),
            0,
          ) / totalRiders;

        const totalCheckIns = group.registrations.reduce(
          (sum, r) => sum + r.checkIns.length,
          0,
        );

        const violationRate =
          totalRiders > 0 ? (totalViolations / totalRiders) * 100 : 0;
        const missedRate =
          totalCheckIns > 0 ? (totalMissed / totalCheckIns) * 100 : 0;
        const optOutRate =
          totalRiders > 0 ? (totalOptOut / totalRiders) * 100 : 0;

        let riskScore = 0;
        riskScore += (100 - avgSafetyScore) * 0.4;
        riskScore += violationRate * 2;
        riskScore += missedRate * 1.5;
        riskScore += optOutRate * 2;
        riskScore += (10 - avgRiderLevel) * 2;

        riskScore = Math.min(100, Math.max(0, riskScore));

        if (!speedLevelRisk[group.speedLevel]) {
          speedLevelRisk[group.speedLevel] = { avgRisk: 0, count: 0 };
        }
        speedLevelRisk[group.speedLevel].avgRisk += riskScore;
        speedLevelRisk[group.speedLevel].count++;
      }
    }

    const speedLevelAnalysis = Object.entries(speedLevelRisk).map(
      ([level, data]) => ({
        speedLevel: level,
        avgRiskScore:
          data.count > 0 ? Math.round(data.avgRisk / data.count) : 0,
        groupCount: data.count,
      }),
    );

    return {
      trend,
      speedLevelAnalysis,
      overallStats: {
        totalActivities: activities.length,
        totalGroups: Object.values(monthlyData).reduce(
          (sum, d) => sum + d.total,
          0,
        ),
        avgOverallRisk:
          Object.values(monthlyData).reduce(
            (sum, d) => sum + d.riskScores.reduce((a, b) => a + b, 0),
            0,
          ) /
            Object.values(monthlyData).reduce(
              (sum, d) => sum + d.riskScores.length,
              0,
            ) || 0,
      },
    };
  }
}
