import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateViolationDto } from "./dto/violation.dto";
import { ViolationType } from "@prisma/client";
import { VIOLATION_POINTS, judgeMissedCheckpoint } from "../common/rules";

@Injectable()
export class ViolationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    activityId: string,
    riderId: string,
    leaderId: string,
    dto: CreateViolationDto,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以记录违规");
    }

    const registration = await this.prisma.registration.findUnique({
      where: {
        activityId_riderId: {
          activityId,
          riderId,
        },
      },
    });

    if (!registration || registration.cancelledAt) {
      throw new NotFoundException("该用户未报名此活动");
    }

    const pointsDeducted = dto.pointsDeducted ?? VIOLATION_POINTS[dto.type];

    return this.prisma.$transaction(async (tx) => {
      const violation = await tx.violation.create({
        data: {
          ...dto,
          pointsDeducted,
          riderId,
          activityId,
          registrationId: registration.id,
          groupId: registration.groupId,
          recordedBy: leaderId,
        },
      });

      await tx.user.update({
        where: { id: riderId },
        data: {
          safetyScore: {
            decrement: pointsDeducted,
          },
        },
      });

      return violation;
    });
  }

  async findByActivity(activityId: string, currentUserId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== currentUserId) {
      return this.prisma.violation.findMany({
        where: {
          activityId,
          riderId: currentUserId,
        },
        include: {
          rider: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
        orderBy: { recordedAt: "desc" },
      });
    }

    return this.prisma.violation.findMany({
      where: { activityId },
      include: {
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
          },
        },
        registration: {
          select: {
            id: true,
            bikeType: true,
          },
        },
      },
      orderBy: { recordedAt: "desc" },
    });
  }

  async findByRider(riderId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.violation.findMany({
        where: { riderId },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startAt: true,
            },
          },
        },
        orderBy: { recordedAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.violation.count({ where: { riderId } }),
    ]);

    const totalPointsDeducted = await this.prisma.violation.aggregate({
      where: { riderId },
      _sum: {
        pointsDeducted: true,
      },
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPointsDeducted: totalPointsDeducted._sum.pointsDeducted || 0,
    };
  }

  async findOne(id: string, currentUserId: string) {
    const violation = await this.prisma.violation.findUnique({
      where: { id },
      include: {
        activity: true,
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    if (!violation) {
      throw new NotFoundException("违规记录不存在");
    }

    if (
      violation.riderId !== currentUserId &&
      violation.activity.leaderId !== currentUserId
    ) {
      throw new ForbiddenException("无权查看此违规记录");
    }

    return violation;
  }

  async checkNightRideEquipment(activityId: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        registrations: {
          where: { cancelledAt: null },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以检查装备");
    }

    if (!activity.isNightRide) {
      return { message: "此活动不是夜骑，无需检查车灯" };
    }

    const results: Array<{
      riderId: string;
      violation: any;
    }> = [];
    for (const registration of activity.registrations) {
      if (!registration.hasLights) {
        const existingViolation = await this.prisma.violation.findFirst({
          where: {
            activityId,
            riderId: registration.riderId,
            type: ViolationType.NO_LIGHTS_NIGHT_RIDE,
          },
        });

        if (!existingViolation) {
          const violation = await this.create(
            activityId,
            registration.riderId,
            leaderId,
            {
              type: ViolationType.NO_LIGHTS_NIGHT_RIDE,
              description: "夜骑未携带车灯",
            },
          );
          results.push({
            riderId: registration.riderId,
            violation,
          });
        }
      }

      if (!registration.hasHelmet) {
        const existingViolation = await this.prisma.violation.findFirst({
          where: {
            activityId,
            riderId: registration.riderId,
            type: ViolationType.NO_HELMET,
          },
        });

        if (!existingViolation) {
          const violation = await this.create(
            activityId,
            registration.riderId,
            leaderId,
            {
              type: ViolationType.NO_HELMET,
              description: "骑行未佩戴头盔",
            },
          );
          results.push({
            riderId: registration.riderId,
            violation,
          });
        }
      }
    }

    return {
      activity: activity.title,
      isNightRide: true,
      totalChecked: activity.registrations.length,
      violationsFound: results.length,
      results,
    };
  }

  async autoRecordMissedCheckpoints(activityId: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        checkpoints: {
          orderBy: { orderIndex: "asc" },
        },
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

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以执行此操作");
    }

    const violationResults: Array<{
      riderId: string;
      checkpoint: string;
      reason: string;
      violation: any;
    }> = [];

    const excusedResults: Array<{
      riderId: string;
      checkpoint: string;
      reason: string;
    }> = [];

    for (const registration of activity.registrations) {
      if (registration.optOutReason) {
        continue;
      }

      for (const checkpoint of activity.checkpoints) {
        const checkIn = registration.checkIns.find(
          (ci) => ci.checkpointId === checkpoint.id,
        );

        const judgment = judgeMissedCheckpoint(checkIn, checkpoint.name);

        if (!judgment.isMissed) {
          continue;
        }

        if (judgment.hasExcuse) {
          excusedResults.push({
            riderId: registration.riderId,
            checkpoint: checkpoint.name,
            reason: judgment.reason,
          });
          continue;
        }

        const existingViolation = await this.prisma.violation.findFirst({
          where: {
            activityId,
            riderId: registration.riderId,
            type: ViolationType.MISSED_CHECKPOINT,
            description: {
              contains: checkpoint.name,
            },
          },
        });

        if (!existingViolation) {
          const violation = await this.create(
            activityId,
            registration.riderId,
            leaderId,
            {
              type: ViolationType.MISSED_CHECKPOINT,
              description: `未签到：${checkpoint.name}（${judgment.reason}）`,
            },
          );
          violationResults.push({
            riderId: registration.riderId,
            checkpoint: checkpoint.name,
            reason: judgment.reason,
            violation,
          });
        }
      }
    }

    return {
      activity: activity.title,
      totalCheckpoints: activity.checkpoints.length,
      violationsRecorded: violationResults.length,
      excusedMissed: excusedResults.length,
      violationResults,
      excusedResults,
    };
  }
}
