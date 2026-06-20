import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  CreateEventDto,
  ChangeRouteDto,
} from './dto/create-activity.dto';
import {
  ActivityStatus,
  EventType,
  UserRole,
  CheckpointType,
} from '@prisma/client';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async create(leaderId: string, dto: CreateActivityDto) {
    const startAt = new Date(dto.startAt);

    const checkpointData = dto.checkpoints.map((cp) => ({
      ...cp,
      expectedTime: cp.expectedTime ? new Date(cp.expectedTime) : null,
    }));

    const activity = await this.prisma.activity.create({
      data: {
        title: dto.title,
        description: dto.description,
        routeLevel: dto.routeLevel,
        meetingPoint: dto.meetingPoint,
        meetingLat: dto.meetingLat,
        meetingLng: dto.meetingLng,
        startAt,
        estimatedMileage: dto.estimatedMileage,
        estimatedElevation: dto.estimatedElevation,
        maxParticipants: dto.maxParticipants,
        requiredEquipment: dto.requiredEquipment,
        isNightRide: dto.isNightRide || false,
        leaderId,
        checkpoints: {
          create: checkpointData,
        },
      },
      include: {
        leader: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        checkpoints: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return activity;
  }

  async findAll(page: number = 1, pageSize: number = 10, status?: ActivityStatus, level?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (level) {
      where.routeLevel = level;
    }

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: {
          leader: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
          checkpoints: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { registrations: { where: { cancelledAt: null } } },
          },
        },
        orderBy: { startAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        leader: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
          },
        },
        checkpoints: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: { checkIns: true },
            },
          },
        },
        registrations: {
          where: { cancelledAt: null },
          include: {
            rider: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
                bikeType: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { registrations: { where: { cancelledAt: null } } },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    return activity;
  }

  async update(id: string, leaderId: string, dto: UpdateActivityDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以编辑');
    }

    if (
      activity.status !== ActivityStatus.DRAFT &&
      activity.status !== ActivityStatus.PUBLISHED
    ) {
      throw new BadRequestException('活动已开始，无法编辑基本信息');
    }

    const updateData: any = { ...dto };
    if (dto.startAt) {
      updateData.startAt = new Date(dto.startAt);
    }

    return this.prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        leader: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
        checkpoints: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  async publish(id: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以发布');
    }

    if (activity.status !== ActivityStatus.DRAFT) {
      throw new BadRequestException('活动状态不正确');
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: ActivityStatus.PUBLISHED },
    });
  }

  async start(id: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以开始');
    }

    if (activity.status !== ActivityStatus.PUBLISHED && activity.status !== ActivityStatus.REGISTRATION_CLOSED) {
      throw new BadRequestException('活动状态不正确');
    }

    const registrations = await this.prisma.registration.findMany({
      where: { activityId: id, cancelledAt: null },
      include: { checkIns: true },
    });

    const startCheckpoint = await this.prisma.checkpoint.findFirst({
      where: { activityId: id, type: CheckpointType.START },
    });

    if (!startCheckpoint) {
      throw new BadRequestException('活动未设置出发点');
    }

    const checkIns = registrations
      .filter((reg) => !reg.checkIns.some((ci) => ci.checkpointId === startCheckpoint.id))
      .map((reg) => ({
        registrationId: reg.id,
        checkpointId: startCheckpoint.id,
        riderId: reg.riderId,
        activityId: id,
      }));

    await this.prisma.$transaction([
      this.prisma.checkIn.createMany({ data: checkIns }),
      this.prisma.activity.update({
        where: { id },
        data: {
          status: ActivityStatus.IN_PROGRESS,
          actualStartTime: new Date(),
        },
      }),
    ]);

    return this.findOne(id);
  }

  async pause(id: string, leaderId: string, reason: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以暂停');
    }

    if (activity.status !== ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException('只有进行中的活动可以暂停');
    }

    await this.prisma.$transaction([
      this.prisma.activityEvent.create({
        data: {
          activityId: id,
          type: EventType.PAUSE,
          title: '活动暂停',
          description: reason,
          createdBy: leaderId,
        },
      }),
      this.prisma.activity.update({
        where: { id },
        data: { status: ActivityStatus.PAUSED },
      }),
    ]);

    return this.findOne(id);
  }

  async resume(id: string, leaderId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以恢复');
    }

    if (activity.status !== ActivityStatus.PAUSED) {
      throw new BadRequestException('只有暂停的活动可以恢复');
    }

    await this.prisma.$transaction([
      this.prisma.activityEvent.create({
        data: {
          activityId: id,
          type: EventType.RESUME,
          title: '活动恢复',
          createdBy: leaderId,
        },
      }),
      this.prisma.activity.update({
        where: { id },
        data: { status: ActivityStatus.IN_PROGRESS },
      }),
    ]);

    return this.findOne(id);
  }

  async finish(id: string, leaderId: string, actualMileage?: number) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以结束');
    }

    if (
      activity.status !== ActivityStatus.IN_PROGRESS &&
      activity.status !== ActivityStatus.PAUSED
    ) {
      throw new BadRequestException('活动状态不正确');
    }

    const endCheckpoint = await this.prisma.checkpoint.findFirst({
      where: { activityId: id, type: CheckpointType.END },
    });

    const completedRegistrations = endCheckpoint
      ? await this.prisma.registration.count({
          where: {
            activityId: id,
            cancelledAt: null,
            checkIns: {
              some: {
                checkpointId: endCheckpoint.id,
                status: 'CHECKED_IN',
              },
            },
          },
        })
      : 0;

    await this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.COMPLETED,
        actualEndTime: new Date(),
        actualMileage,
        completedCount: completedRegistrations,
      },
    });

    return this.findOne(id);
  }

  async cancel(id: string, leaderId: string, reason: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以取消');
    }

    if (activity.status === ActivityStatus.IN_PROGRESS || activity.status === ActivityStatus.COMPLETED) {
      throw new BadRequestException('活动已开始或已完成，无法取消');
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.CANCELLED,
        description: activity.description ? `${activity.description}\n\n取消原因：${reason}` : `取消原因：${reason}`,
      },
    });
  }

  async changeRoute(id: string, leaderId: string, dto: ChangeRouteDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以改线');
    }

    if (
      activity.status !== ActivityStatus.IN_PROGRESS &&
      activity.status !== ActivityStatus.PAUSED
    ) {
      throw new BadRequestException('只有进行中的活动可以改线');
    }

    await this.prisma.$transaction([
      this.prisma.checkpoint.deleteMany({ where: { activityId: id } }),
      this.prisma.checkpoint.createMany({
        data: dto.checkpoints.map((cp) => ({
          ...cp,
          activityId: id,
          expectedTime: cp.expectedTime ? new Date(cp.expectedTime) : null,
        })),
      }),
      this.prisma.activityEvent.create({
        data: {
          activityId: id,
          type: EventType.ROUTE_CHANGE,
          title: dto.title,
          description: dto.description,
          newRoute: {
            checkpoints: dto.checkpoints,
          } as any,
          createdBy: leaderId,
        },
      }),
    ]);

    return this.findOne(id);
  }

  async addEvent(id: string, leaderId: string, dto: CreateEventDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException('只有活动领队可以添加事件');
    }

    if (
      activity.status !== ActivityStatus.IN_PROGRESS &&
      activity.status !== ActivityStatus.PAUSED
    ) {
      throw new BadRequestException('只有进行中的活动可以添加事件');
    }

    const event = await this.prisma.activityEvent.create({
      data: {
        ...dto,
        type: dto.type as EventType,
        activityId: id,
        createdBy: leaderId,
      },
    });

    return event;
  }

  async getMyLedActivities(leaderId: string, page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { leaderId },
        include: {
          _count: {
            select: { registrations: { where: { cancelledAt: null } } },
          },
        },
        orderBy: { startAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.activity.count({ where: { leaderId } }),
    ]);

    return { items, total, page, pageSize };
  }
}
