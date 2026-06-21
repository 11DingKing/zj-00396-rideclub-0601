import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCheckInDto,
  MissCheckInDto,
  UpdateCheckInStatusDto,
} from "./dto/check-in.dto";
import {
  CheckInStatus,
  CheckpointType,
  ActivityStatus,
  UserRole,
} from "@prisma/client";

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  async checkIn(checkpointId: string, riderId: string, dto: CreateCheckInDto) {
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id: checkpointId },
      include: {
        activity: {
          include: {
            checkpoints: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
      },
    });

    if (!checkpoint) {
      throw new NotFoundException("签到点不存在");
    }

    if (checkpoint.activity.status !== ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动未开始或已结束");
    }

    const registration = await this.prisma.registration.findUnique({
      where: {
        activityId_riderId: {
          activityId: checkpoint.activityId,
          riderId,
        },
      },
      include: {
        checkIns: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    if (!registration || registration.cancelledAt) {
      throw new BadRequestException("您未报名此活动");
    }

    const previousCheckpoints = checkpoint.activity.checkpoints.filter(
      (cp) => cp.orderIndex < checkpoint.orderIndex,
    );

    for (const prevCp of previousCheckpoints) {
      const prevCheckIn = registration.checkIns.find(
        (ci) => ci.checkpointId === prevCp.id,
      );
      if (
        !prevCheckIn ||
        (prevCheckIn.status !== CheckInStatus.CHECKED_IN &&
          prevCheckIn.status !== CheckInStatus.OPT_OUT)
      ) {
        throw new BadRequestException(`请先完成前一个签到点：${prevCp.name}`);
      }
    }

    let checkIn = await this.prisma.checkIn.findUnique({
      where: {
        registrationId_checkpointId: {
          registrationId: registration.id,
          checkpointId,
        },
      },
    });

    if (!checkIn) {
      checkIn = await this.prisma.checkIn.create({
        data: {
          registrationId: registration.id,
          checkpointId,
          riderId,
          activityId: checkpoint.activityId,
          status: CheckInStatus.CHECKED_IN,
          checkedInAt: new Date(),
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    } else if (checkIn.status === CheckInStatus.CHECKED_IN) {
      throw new BadRequestException("已在此签到点签到");
    } else {
      checkIn = await this.prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          status: CheckInStatus.CHECKED_IN,
          checkedInAt: new Date(),
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    }

    if (checkpoint.type === CheckpointType.END) {
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { completed: true },
      });
    }

    if (checkpoint.type === CheckpointType.START && !registration.isPresent) {
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { isPresent: true },
      });
    }

    return checkIn;
  }

  async getActivityCheckIns(activityId: string, userId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== userId) {
      const checkIns = await this.prisma.checkIn.findMany({
        where: {
          activityId,
          riderId: userId,
        },
        include: {
          checkpoint: {
            select: {
              id: true,
              name: true,
              type: true,
              orderIndex: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return checkIns;
    }

    return this.prisma.checkIn.findMany({
      where: { activityId },
      include: {
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        checkpoint: {
          select: {
            id: true,
            name: true,
            type: true,
            orderIndex: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getMyCheckIns(activityId: string, riderId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: {
        activityId_riderId: {
          activityId,
          riderId,
        },
      },
    });

    if (!registration) {
      throw new NotFoundException("未报名此活动");
    }

    return this.prisma.checkIn.findMany({
      where: {
        activityId,
        riderId,
      },
      include: {
        checkpoint: {
          select: {
            id: true,
            name: true,
            type: true,
            orderIndex: true,
            description: true,
            expectedTime: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateStatus(
    checkInId: string,
    leaderId: string,
    dto: UpdateCheckInStatusDto,
  ) {
    const checkIn = await this.prisma.checkIn.findUnique({
      where: { id: checkInId },
    });

    if (!checkIn) {
      throw new NotFoundException("签到记录不存在");
    }

    const activity = await this.prisma.activity.findUnique({
      where: { id: checkIn.activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以修改签到状态");
    }

    const updateData: any = {
      status: dto.status,
    };

    if (dto.status === CheckInStatus.MISSED && dto.reason) {
      updateData.missReason = dto.reason;
    }
    if (dto.status === CheckInStatus.OPT_OUT && dto.reason) {
      updateData.optOutReason = dto.reason;
    }
    if (dto.status === CheckInStatus.CHECKED_IN) {
      updateData.checkedInAt = new Date();
    }

    const updatedCheckIn = await this.prisma.checkIn.update({
      where: { id: checkInId },
      data: updateData,
      include: {
        checkpoint: true,
        registration: true,
      },
    });

    if (
      updatedCheckIn.checkpoint.type === CheckpointType.START &&
      dto.status === CheckInStatus.CHECKED_IN &&
      !updatedCheckIn.registration.isPresent
    ) {
      await this.prisma.registration.update({
        where: { id: updatedCheckIn.registrationId },
        data: { isPresent: true },
      });
    }

    return updatedCheckIn;
  }

  async markMissed(checkInId: string, leaderId: string, dto: MissCheckInDto) {
    return this.updateStatus(checkInId, leaderId, {
      status: CheckInStatus.MISSED,
      reason: dto.reason,
    });
  }

  async getCheckpointStatus(checkpointId: string, userId: string) {
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id: checkpointId },
      include: { activity: true },
    });

    if (!checkpoint) {
      throw new NotFoundException("签到点不存在");
    }

    if (checkpoint.activity.leaderId !== userId) {
      throw new ForbiddenException("只有领队可以查看签到点状态");
    }

    const checkIns = await this.prisma.checkIn.findMany({
      where: { checkpointId },
      include: {
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    const total = await this.prisma.registration.count({
      where: {
        activityId: checkpoint.activityId,
        cancelledAt: null,
      },
    });

    const checkedInCount = checkIns.filter(
      (ci) => ci.status === CheckInStatus.CHECKED_IN,
    ).length;
    const missedCount = checkIns.filter(
      (ci) => ci.status === CheckInStatus.MISSED,
    ).length;
    const optOutCount = checkIns.filter(
      (ci) => ci.status === CheckInStatus.OPT_OUT,
    ).length;
    const pendingCount = total - checkedInCount - missedCount - optOutCount;

    return {
      checkpoint,
      total,
      checkedInCount,
      missedCount,
      optOutCount,
      pendingCount,
      checkIns,
    };
  }

  async bulkCreatePendingCheckIns(activityId: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        checkpoints: {
          orderBy: { orderIndex: "asc" },
        },
        registrations: {
          where: { cancelledAt: null },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以批量创建签到");
    }

    const checkInsToCreate: any[] = [];

    for (const registration of activity.registrations) {
      for (const checkpoint of activity.checkpoints) {
        const existing = await this.prisma.checkIn.findUnique({
          where: {
            registrationId_checkpointId: {
              registrationId: registration.id,
              checkpointId: checkpoint.id,
            },
          },
        });
        if (!existing) {
          checkInsToCreate.push({
            registrationId: registration.id,
            checkpointId: checkpoint.id,
            riderId: registration.riderId,
            activityId,
          });
        }
      }
    }

    if (checkInsToCreate.length > 0) {
      await this.prisma.checkIn.createMany({
        data: checkInsToCreate,
      });
    }

    return { created: checkInsToCreate.length };
  }
}
