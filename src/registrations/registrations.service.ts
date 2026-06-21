import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateRegistrationDto,
  OptOutDto,
  MarkPresenceDto,
} from "./dto/registration.dto";
import { CheckInStatus, ActivityStatus, CheckpointType } from "@prisma/client";
import { ACTIVE_STATUSES } from "../common/rules";

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    activityId: string,
    riderId: string,
    dto: CreateRegistrationDto,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        _count: {
          select: { registrations: { where: { cancelledAt: null } } },
        },
        checkpoints: true,
      },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.status !== ActivityStatus.PUBLISHED) {
      throw new BadRequestException("活动未开放报名");
    }

    if (activity._count.registrations >= activity.maxParticipants) {
      throw new ConflictException("活动报名已满");
    }

    const existingRegistration = await this.prisma.registration.findUnique({
      where: {
        activityId_riderId: {
          activityId,
          riderId,
        },
      },
    });

    if (existingRegistration && !existingRegistration.cancelledAt) {
      throw new ConflictException("已报名该活动");
    }

    if (existingRegistration && existingRegistration.cancelledAt) {
      return this.prisma.registration.update({
        where: { id: existingRegistration.id },
        data: {
          ...dto,
          insuranceExpiry: dto.insuranceExpiry
            ? new Date(dto.insuranceExpiry)
            : null,
          cancelledAt: null,
          registeredAt: new Date(),
        },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startAt: true,
              meetingPoint: true,
            },
          },
        },
      });
    }

    return this.prisma.registration.create({
      data: {
        ...dto,
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : null,
        activityId,
        riderId,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            startAt: true,
            meetingPoint: true,
          },
        },
      },
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
      const registrations = await this.prisma.registration.findMany({
        where: {
          activityId,
          riderId: currentUserId,
          cancelledAt: null,
        },
        include: {
          rider: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          checkIns: {
            include: {
              checkpoint: true,
            },
          },
        },
      });
      return registrations;
    }

    return this.prisma.registration.findMany({
      where: { activityId, cancelledAt: null },
      include: {
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
            bikeType: true,
          },
        },
        checkIns: {
          include: {
            checkpoint: true,
          },
        },
        violations: true,
      },
      orderBy: { registeredAt: "asc" },
    });
  }

  async findMyRegistrations(
    riderId: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.registration.findMany({
        where: { riderId, cancelledAt: null },
        include: {
          activity: {
            include: {
              leader: {
                select: {
                  id: true,
                  nickname: true,
                  avatar: true,
                },
              },
            },
          },
          checkIns: {
            include: {
              checkpoint: true,
            },
          },
        },
        orderBy: { registeredAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.registration.count({ where: { riderId, cancelledAt: null } }),
    ]);

    return { items, total, page, pageSize };
  }

  async cancel(id: string, riderId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { activity: true },
    });

    if (!registration) {
      throw new NotFoundException("报名记录不存在");
    }

    if (registration.riderId !== riderId) {
      throw new ForbiddenException("只能取消自己的报名");
    }

    if (registration.cancelledAt) {
      throw new BadRequestException("报名已取消");
    }

    if (registration.activity.status === ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动已开始，无法取消报名");
    }

    return this.prisma.registration.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
  }

  async optOut(id: string, riderId: string, dto: OptOutDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { activity: true },
    });

    if (!registration) {
      throw new NotFoundException("报名记录不存在");
    }

    if (registration.riderId !== riderId) {
      throw new ForbiddenException("只能操作自己的报名");
    }

    if (!ACTIVE_STATUSES.includes(registration.activity.status)) {
      throw new BadRequestException("只有进行中的活动可以申请退队");
    }

    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { activityId: registration.activityId },
      orderBy: { orderIndex: "asc" },
    });

    const updates = checkpoints
      .filter((cp) => cp.type !== CheckpointType.END)
      .map((cp) =>
        this.prisma.checkIn.upsert({
          where: {
            registrationId_checkpointId: {
              registrationId: id,
              checkpointId: cp.id,
            },
          },
          create: {
            registrationId: id,
            checkpointId: cp.id,
            riderId,
            activityId: registration.activityId,
            groupId: registration.groupId,
            status: "OPT_OUT",
            optOutReason: dto.reason,
          },
          update: {
            status: "OPT_OUT",
            optOutReason: dto.reason,
            groupId: registration.groupId,
          },
        }),
      );

    await Promise.all([
      ...updates,
      this.prisma.registration.update({
        where: { id },
        data: { optOutReason: dto.reason, completed: false },
      }),
    ]);

    return { message: "已记录退队", reason: dto.reason };
  }

  async markPresence(id: string, leaderId: string, dto: MarkPresenceDto) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { activity: true },
    });

    if (!registration) {
      throw new NotFoundException("报名记录不存在");
    }

    if (registration.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有领队可以标记到场");
    }

    const startCheckpoint = await this.prisma.checkpoint.findFirst({
      where: {
        activityId: registration.activityId,
        type: CheckpointType.START,
      },
    });

    if (!startCheckpoint) {
      throw new BadRequestException("活动未设置出发点");
    }

    if (dto.isPresent) {
      await this.prisma.checkIn.upsert({
        where: {
          registrationId_checkpointId: {
            registrationId: id,
            checkpointId: startCheckpoint.id,
          },
        },
        create: {
          registrationId: id,
          checkpointId: startCheckpoint.id,
          riderId: registration.riderId,
          activityId: registration.activityId,
          groupId: registration.groupId,
          status: CheckInStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
        update: {
          status: CheckInStatus.CHECKED_IN,
          checkedInAt: new Date(),
          groupId: registration.groupId,
        },
      });

      await this.prisma.registration.update({
        where: { id },
        data: { isPresent: true },
      });
    } else {
      await this.prisma.checkIn.upsert({
        where: {
          registrationId_checkpointId: {
            registrationId: id,
            checkpointId: startCheckpoint.id,
          },
        },
        create: {
          registrationId: id,
          checkpointId: startCheckpoint.id,
          riderId: registration.riderId,
          activityId: registration.activityId,
          status: CheckInStatus.MISSED,
        },
        update: {
          status: CheckInStatus.MISSED,
          checkedInAt: null,
        },
      });

      await this.prisma.registration.update({
        where: { id },
        data: { isPresent: false, completed: false },
      });
    }

    return this.prisma.registration.findUnique({
      where: { id },
      include: {
        checkIns: {
          include: { checkpoint: true },
        },
      },
    });
  }

  async getRegistrationDetail(id: string, userId: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        rider: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
            bikeType: true,
            bikeBrand: true,
          },
        },
        activity: {
          include: {
            leader: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
              },
            },
            checkpoints: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        checkIns: {
          include: {
            checkpoint: true,
          },
          orderBy: { createdAt: "asc" },
        },
        violations: true,
      },
    });

    if (!registration) {
      throw new NotFoundException("报名记录不存在");
    }

    if (
      registration.riderId !== userId &&
      registration.activity.leaderId !== userId
    ) {
      throw new ForbiddenException("无权查看此报名详情");
    }

    return registration;
  }
}
