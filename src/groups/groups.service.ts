import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateGroupDto,
  UpdateGroupDto,
  AssignRidersDto,
  AutoAssignDto,
  GroupBroadcastDto,
  UpdateGroupRoleDto,
} from "./dto/group.dto";
import {
  ActivityStatus,
  EventType,
  GroupRole,
  SpeedLevel,
  RouteLevel,
  CheckpointType,
  CheckInStatus,
} from "@prisma/client";

const EXPERIENCE_ORDER: Record<RouteLevel, number> = {
  [RouteLevel.BEGINNER]: 1,
  [RouteLevel.INTERMEDIATE]: 2,
  [RouteLevel.ADVANCED]: 3,
  [RouteLevel.EXPERT]: 4,
};

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(
    activityId: string,
    leaderId: string,
    dto: CreateGroupDto,
  ) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以创建分组");
    }

    if (activity.status === ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动进行中无法创建分组");
    }

    const existingGroup = await this.prisma.activityGroup.findUnique({
      where: {
        activityId_name: {
          activityId,
          name: dto.name,
        },
      },
    });

    if (existingGroup) {
      throw new ConflictException("分组名称已存在");
    }

    if (dto.leaderId) {
      const leaderRegistration = await this.prisma.registration.findUnique({
        where: {
          activityId_riderId: {
            activityId,
            riderId: dto.leaderId,
          },
        },
      });
      if (!leaderRegistration || leaderRegistration.cancelledAt) {
        throw new BadRequestException("领骑未报名此活动");
      }
    }

    if (dto.sweeperId) {
      const sweeperRegistration = await this.prisma.registration.findUnique({
        where: {
          activityId_riderId: {
            activityId,
            riderId: dto.sweeperId,
          },
        },
      });
      if (!sweeperRegistration || sweeperRegistration.cancelledAt) {
        throw new BadRequestException("收队未报名此活动");
      }
    }

    const group = await this.prisma.activityGroup.create({
      data: {
        ...dto,
        activityId,
      },
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
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (dto.leaderId) {
      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId,
            riderId: dto.leaderId,
          },
        },
        data: {
          groupId: group.id,
          groupRole: GroupRole.LEADER,
        },
      });
    }

    if (dto.sweeperId) {
      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId,
            riderId: dto.sweeperId,
          },
        },
        data: {
          groupId: group.id,
          groupRole: GroupRole.SWEEPER,
        },
      });
    }

    return group;
  }

  async findByActivity(activityId: string, currentUserId: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== currentUserId) {
      const userRegistration = await this.prisma.registration.findUnique({
        where: {
          activityId_riderId: {
            activityId,
            riderId: currentUserId,
          },
        },
      });

      if (!userRegistration || userRegistration.cancelledAt) {
        return [];
      }

      return this.prisma.activityGroup.findMany({
        where: {
          activityId,
          registrations: {
            some: {
              riderId: currentUserId,
            },
          },
        },
        include: {
          leader: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
              phone: true,
            },
          },
          sweeper: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
              phone: true,
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
                },
              },
            },
          },
          _count: {
            select: { registrations: true },
          },
        },
        orderBy: { orderIndex: "asc" },
      });
    }

    return this.prisma.activityGroup.findMany({
      where: { activityId },
      include: {
        leader: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
          },
        },
        sweeper: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
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
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { orderIndex: "asc" },
    });
  }

  async findOne(groupId: string, currentUserId: string) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: {
        activity: true,
        leader: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
          },
        },
        sweeper: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
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
        },
        events: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (
      group.activity.leaderId !== currentUserId &&
      group.leaderId !== currentUserId &&
      group.sweeperId !== currentUserId
    ) {
      const userInGroup = group.registrations.some(
        (r) => r.riderId === currentUserId,
      );
      if (!userInGroup) {
        throw new ForbiddenException("无权查看此分组");
      }
    }

    return group;
  }

  async update(
    groupId: string,
    leaderId: string,
    dto: UpdateGroupDto,
  ) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以编辑分组");
    }

    if (group.activity.status === ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动进行中无法编辑分组");
    }

    if (dto.name && dto.name !== group.name) {
      const existingGroup = await this.prisma.activityGroup.findUnique({
        where: {
          activityId_name: {
            activityId: group.activityId,
            name: dto.name,
          },
        },
      });
      if (existingGroup) {
        throw new ConflictException("分组名称已存在");
      }
    }

    if (dto.leaderId) {
      const leaderRegistration = await this.prisma.registration.findUnique({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: dto.leaderId,
          },
        },
      });
      if (!leaderRegistration || leaderRegistration.cancelledAt) {
        throw new BadRequestException("领骑未报名此活动");
      }
      if (
        leaderRegistration.groupId &&
        leaderRegistration.groupId !== groupId
      ) {
        throw new BadRequestException("领骑已属于其他分组");
      }

      if (group.leaderId) {
        await this.prisma.registration.update({
          where: {
            activityId_riderId: {
              activityId: group.activityId,
              riderId: group.leaderId,
            },
          },
          data: { groupRole: GroupRole.RIDER },
        });
      }

      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: dto.leaderId,
          },
        },
        data: {
          groupId: groupId,
          groupRole: GroupRole.LEADER,
        },
      });
    }

    if (dto.sweeperId) {
      const sweeperRegistration = await this.prisma.registration.findUnique({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: dto.sweeperId,
          },
        },
      });
      if (!sweeperRegistration || sweeperRegistration.cancelledAt) {
        throw new BadRequestException("收队未报名此活动");
      }
      if (
        sweeperRegistration.groupId &&
        sweeperRegistration.groupId !== groupId
      ) {
        throw new BadRequestException("收队已属于其他分组");
      }

      if (group.sweeperId) {
        await this.prisma.registration.update({
          where: {
            activityId_riderId: {
              activityId: group.activityId,
              riderId: group.sweeperId,
            },
          },
          data: { groupRole: GroupRole.RIDER },
        });
      }

      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: dto.sweeperId,
          },
        },
        data: {
          groupId: groupId,
          groupRole: GroupRole.SWEEPER,
        },
      });
    }

    return this.prisma.activityGroup.update({
      where: { id: groupId },
      data: dto,
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
        _count: {
          select: { registrations: true },
        },
      },
    });
  }

  async remove(groupId: string, leaderId: string) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true, _count: { select: { registrations: true } } },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以删除分组");
    }

    if (group.activity.status === ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动进行中无法删除分组");
    }

    if (group._count.registrations > 0) {
      throw new BadRequestException("分组内还有骑手，无法删除");
    }

    return this.prisma.activityGroup.delete({
      where: { id: groupId },
    });
  }

  async assignRiders(
    groupId: string,
    leaderId: string,
    dto: AssignRidersDto,
  ) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以分配骑手");
    }

    const results = [];

    for (const assignment of dto.assignments) {
      const registration = await this.prisma.registration.findUnique({
        where: { id: assignment.registrationId },
      });

      if (!registration || registration.activityId !== group.activityId) {
        continue;
      }

      if (registration.cancelledAt) {
        continue;
      }

      if (
        assignment.groupRole === GroupRole.LEADER &&
        group.leaderId &&
        group.leaderId !== registration.riderId
      ) {
        throw new BadRequestException("该分组已有领骑");
      }
      if (
        assignment.groupRole === GroupRole.SWEEPER &&
        group.sweeperId &&
        group.sweeperId !== registration.riderId
      ) {
        throw new BadRequestException("该分组已有收队");
      }

      const updated = await this.prisma.registration.update({
        where: { id: assignment.registrationId },
        data: {
          groupId: groupId,
          groupRole: assignment.groupRole || GroupRole.RIDER,
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
      });

      results.push(updated);
    }

    return { assigned: results.length, results };
  }

  async removeRider(groupId: string, registrationId: string, leaderId: string) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以移除骑手");
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration || registration.groupId !== groupId) {
      throw new NotFoundException("该骑手不在此分组");
    }

    if (registration.groupRole === GroupRole.LEADER) {
      throw new BadRequestException("请先更换领骑后再移除");
    }
    if (registration.groupRole === GroupRole.SWEEPER) {
      throw new BadRequestException("请先更换收队后再移除");
    }

    return this.prisma.registration.update({
      where: { id: registrationId },
      data: {
        groupId: null,
        groupRole: GroupRole.RIDER,
      },
    });
  }

  async updateRiderRole(
    groupId: string,
    registrationId: string,
    leaderId: string,
    dto: UpdateGroupRoleDto,
  ) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以修改角色");
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration || registration.groupId !== groupId) {
      throw new NotFoundException("该骑手不在此分组");
    }

    if (dto.role === GroupRole.LEADER && group.leaderId) {
      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: group.leaderId,
          },
        },
        data: { groupRole: GroupRole.RIDER },
      });
    }

    if (dto.role === GroupRole.SWEEPER && group.sweeperId) {
      await this.prisma.registration.update({
        where: {
          activityId_riderId: {
            activityId: group.activityId,
            riderId: group.sweeperId,
          },
        },
        data: { groupRole: GroupRole.RIDER },
      });
    }

    const updatedRegistration = await this.prisma.registration.update({
      where: { id: registrationId },
      data: { groupRole: dto.role },
    });

    const groupUpdateData: any = {};
    if (dto.role === GroupRole.LEADER) {
      groupUpdateData.leaderId = registration.riderId;
    } else if (dto.role === GroupRole.SWEEPER) {
      groupUpdateData.sweeperId = registration.riderId;
    }

    if (Object.keys(groupUpdateData).length > 0) {
      await this.prisma.activityGroup.update({
        where: { id: groupId },
        data: groupUpdateData,
      });
    }

    return updatedRegistration;
  }

  async autoAssign(activityId: string, leaderId: string, dto: AutoAssignDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        groups: {
          orderBy: { orderIndex: "asc" },
        },
        registrations: {
          where: { cancelledAt: null },
          include: {
            rider: {
              select: {
                level: true,
                recentRideCapacity: true,
              },
            },
          },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException("活动不存在");
    }

    if (activity.leaderId !== leaderId) {
      throw new ForbiddenException("只有活动领队可以自动分组");
    }

    if (activity.status === ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("活动进行中无法自动分组");
    }

    if (activity.groups.length === 0) {
      throw new BadRequestException("请先创建分组");
    }

    const unassignedRiders = activity.registrations.filter(
      (r) => !r.groupId,
    );

    if (unassignedRiders.length === 0) {
      return { message: "所有骑手已分配", assigned: 0 };
    }

    const minGroupSize = dto.minGroupSize || 5;
    const maxGroupSize = dto.maxGroupSize || 15;

    let sortedRiders = [...unassignedRiders];

    if (dto.bySpeed) {
      const speedOrder: Record<SpeedLevel, number> = {
        [SpeedLevel.SLOW]: 1,
        [SpeedLevel.MODERATE]: 2,
        [SpeedLevel.FAST]: 3,
        [SpeedLevel.RACING]: 4,
      };
      sortedRiders.sort((a, b) => {
        const aSpeed = a.selfReportedSpeed
          ? speedOrder[a.selfReportedSpeed]
          : 0;
        const bSpeed = b.selfReportedSpeed
          ? speedOrder[b.selfReportedSpeed]
          : 0;
        return bSpeed - aSpeed;
      });
    } else if (dto.byExperience) {
      sortedRiders.sort((a, b) => {
        return (b.rider?.level || 0) - (a.rider?.level || 0);
      });
    }

    const groups = [...activity.groups].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );

    let assignedCount = 0;
    let groupIndex = 0;

    for (const rider of sortedRiders) {
      const targetGroup = groups[groupIndex % groups.length];

      const currentCount = await this.prisma.registration.count({
        where: {
          activityId,
          groupId: targetGroup.id,
          cancelledAt: null,
        },
      });

      if (currentCount >= maxGroupSize) {
        groupIndex++;
        continue;
      }

      const riderExperience = rider.rider?.level || 1;
      const minExp = EXPERIENCE_ORDER[targetGroup.minExperience];

      if (dto.byExperience && riderExperience < minExp) {
        continue;
      }

      await this.prisma.registration.update({
        where: { id: rider.id },
        data: {
          groupId: targetGroup.id,
          groupRole: GroupRole.RIDER,
        },
      });

      assignedCount++;
      groupIndex++;
    }

    return {
      totalRiders: unassignedRiders.length,
      assignedCount,
      remaining: unassignedRiders.length - assignedCount,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        speedLevel: g.speedLevel,
      })),
    };
  }

  async sendBroadcast(
    groupId: string,
    senderId: string,
    dto: GroupBroadcastDto,
  ) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (
      group.activity.leaderId !== senderId &&
      group.leaderId !== senderId &&
      group.sweeperId !== senderId
    ) {
      throw new ForbiddenException("只有领队或收队可以发送广播");
    }

    if (group.activity.status !== ActivityStatus.IN_PROGRESS) {
      throw new BadRequestException("只有进行中的活动可以发送广播");
    }

    const event = await this.prisma.activityEvent.create({
      data: {
        activityId: group.activityId,
        groupId: groupId,
        type: EventType.SAFETY_BROADCAST,
        title: dto.title,
        description: dto.description,
        createdBy: senderId,
      },
    });

    return event;
  }

  async getGroupCheckpointStats(groupId: string, checkpointId: string, currentUserId: string) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: { activity: true },
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (
      group.activity.leaderId !== currentUserId &&
      group.leaderId !== currentUserId &&
      group.sweeperId !== currentUserId
    ) {
      throw new ForbiddenException("无权查看此分组签到统计");
    }

    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id: checkpointId },
    });

    if (!checkpoint || checkpoint.activityId !== group.activityId) {
      throw new NotFoundException("签到点不存在");
    }

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        groupId,
        checkpointId,
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
    });

    const totalRiders = await this.prisma.registration.count({
      where: {
        groupId,
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
    const pendingCount = totalRiders - checkedInCount - missedCount - optOutCount;

    return {
      group,
      checkpoint,
      totalRiders,
      checkedInCount,
      missedCount,
      optOutCount,
      pendingCount,
      checkIns,
    };
  }

  async getGroupRiskAnalysis(groupId: string, currentUserId: string) {
    const group = await this.prisma.activityGroup.findUnique({
      where: { id: groupId },
      include: {
        activity: {
          include: {
            checkpoints: true,
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
    });

    if (!group) {
      throw new NotFoundException("分组不存在");
    }

    if (group.activity.leaderId !== currentUserId) {
      throw new ForbiddenException("只有活动领队可以查看风险分析");
    }

    const totalRiders = group.registrations.length;

    if (totalRiders === 0) {
      return {
        group,
        riskScore: 0,
        riskLevel: "LOW",
        metrics: {
          totalRiders: 0,
          avgSafetyScore: 100,
          violationRate: 0,
          missedCheckpointRate: 0,
          optOutRate: 0,
          avgRiderLevel: 0,
        },
      };
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
      group.registrations.reduce(
        (sum, r) => sum + (r.rider?.level || 0),
        0,
      ) / totalRiders;

    const totalCheckIns = group.registrations.reduce(
      (sum, r) => sum + r.checkIns.length,
      0,
    );

    const violationRate = totalRiders > 0 ? (totalViolations / totalRiders) * 100 : 0;
    const missedRate = totalCheckIns > 0 ? (totalMissed / totalCheckIns) * 100 : 0;
    const optOutRate = totalRiders > 0 ? (totalOptOut / totalRiders) * 100 : 0;

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
      .filter((r) => (r.rider?.safetyScore || 100) < 70 || r.violations.length > 0)
      .map((r) => ({
        riderId: r.riderId,
        safetyScore: r.rider?.safetyScore,
        violations: r.violations.length,
        missedCheckpoints: r.checkIns.filter(
          (ci) => ci.status === CheckInStatus.MISSED,
        ).length,
        hasOptOut: !!r.optOutReason,
      }));

    return {
      group,
      riskScore: Math.round(riskScore),
      riskLevel,
      metrics: {
        totalRiders,
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
    };
  }
}
