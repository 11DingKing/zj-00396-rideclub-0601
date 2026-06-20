import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Activity, User, CheckpointType, CheckInStatus } from '@prisma/client';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  async calculateAndDistributePoints(activityId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        checkpoints: {
          orderBy: { orderIndex: 'asc' },
        },
        registrations: {
          where: { cancelledAt: null },
          include: {
            checkIns: {
              include: {
                checkpoint: true,
              },
            },
            violations: true,
          },
        },
      },
    });

    if (!activity) {
      throw new Error('活动不存在');
    }

    const mileage = activity.actualMileage || activity.estimatedMileage;
    const results: Array<{
      riderId: string;
      points: number;
      mileage: number;
      violations: number;
    }> = [];

    for (const registration of activity.registrations) {
      if (!registration.isPresent) {
        continue;
      }

      const endCheckIn = registration.checkIns.find(
        (ci) => ci.checkpoint.type === CheckpointType.END && ci.status === CheckInStatus.CHECKED_IN,
      );

      if (!endCheckIn) {
        continue;
      }

      const allCheckIns = registration.checkIns.filter(
        (ci) => ci.status === CheckInStatus.CHECKED_IN,
      );

      const hasAllCheckpoints = activity.checkpoints.every((cp) =>
        registration.checkIns.some(
          (ci) => ci.checkpointId === cp.id && ci.status === CheckInStatus.CHECKED_IN,
        ),
      );

      let basePoints = Math.floor(mileage);
      if (hasAllCheckpoints) {
        basePoints += 10;
      }

      if (activity.routeLevel === 'ADVANCED') {
        basePoints += 15;
      } else if (activity.routeLevel === 'EXPERT') {
        basePoints += 30;
      }

      const totalViolationPoints = registration.violations.reduce(
        (sum, v) => sum + v.pointsDeducted,
        0,
      );

      const finalPoints = Math.max(0, basePoints - totalViolationPoints);
      const finalMileage = mileage;

      await this.addPoints(
        registration.riderId,
        activityId,
        'ACTIVITY_COMPLETION',
        finalPoints,
        finalMileage,
        `完成活动：${activity.title}`,
      );

      results.push({
        riderId: registration.riderId,
        points: finalPoints,
        mileage: finalMileage,
        violations: registration.violations.length,
      });
    }

    return {
      activity: activity.title,
      totalParticipants: activity.registrations.length,
      awardedCount: results.length,
      results,
    };
  }

  async addPoints(
    userId: string,
    activityId: string | null,
    type: string,
    points: number,
    mileage: number = 0,
    description?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.pointsLog.create({
        data: {
          userId,
          activityId,
          type,
          points,
          mileage,
          description,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          totalMileage: true,
          totalRides: true,
          level: true,
        },
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const newTotalMileage = user.totalMileage + mileage;
      const newTotalRides = type === 'ACTIVITY_COMPLETION' ? user.totalRides + 1 : user.totalRides;
      const newLevel = this.calculateLevel(newTotalMileage);

      await tx.user.update({
        where: { id: userId },
        data: {
          totalMileage: newTotalMileage,
          totalRides: newTotalRides,
          level: newLevel,
        },
      });

      return { userId, points, mileage, newLevel };
    });
  }

  async getUserPointsHistory(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.pointsLog.findMany({
        where: { userId },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.pointsLog.count({ where: { userId } }),
    ]);

    const totalPoints = await this.prisma.pointsLog.aggregate({
      where: { userId },
      _sum: {
        points: true,
      },
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPoints: totalPoints._sum.points || 0,
    };
  }

  private calculateLevel(totalMileage: number): number {
    if (totalMileage >= 10000) return 10;
    if (totalMileage >= 5000) return 9;
    if (totalMileage >= 3000) return 8;
    if (totalMileage >= 2000) return 7;
    if (totalMileage >= 1000) return 6;
    if (totalMileage >= 500) return 5;
    if (totalMileage >= 200) return 4;
    if (totalMileage >= 100) return 3;
    if (totalMileage >= 50) return 2;
    return 1;
  }

  async getLeaderboard(
    type: 'mileage' | 'rides' | 'score',
    limit: number = 20,
  ) {
    const orderBy: any = {};
    if (type === 'mileage') {
      orderBy.totalMileage = 'desc';
    } else if (type === 'rides') {
      orderBy.totalRides = 'desc';
    } else {
      orderBy.safetyScore = 'desc';
    }

    return this.prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        avatar: true,
        totalMileage: true,
        totalRides: true,
        safetyScore: true,
        level: true,
      },
      orderBy,
      take: limit,
    });
  }
}
