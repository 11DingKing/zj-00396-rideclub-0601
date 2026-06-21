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
}
