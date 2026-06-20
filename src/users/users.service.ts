import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        role: true,
        realName: true,
        totalMileage: true,
        totalRides: true,
        safetyScore: true,
        level: true,
        bikeType: true,
        bikeBrand: true,
        insuranceExpiry: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        recentRideCapacity: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (dto.insuranceExpiry) {
      (dto as any).insuranceExpiry = new Date(dto.insuranceExpiry);
    }
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        role: true,
      },
    });
  }

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalMileage: true,
        totalRides: true,
        safetyScore: true,
        level: true,
      },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const registrationCount = await this.prisma.registration.count({
      where: { riderId: userId, cancelledAt: null },
    });

    const completedCount = await this.prisma.registration.count({
      where: { riderId: userId, completed: true },
    });

    const violationCount = await this.prisma.violation.count({
      where: { riderId: userId },
    });

    return {
      ...user,
      registrationCount,
      completedCount,
      violationCount,
    };
  }

  async getUserRideHistory(userId: string, page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    return this.prisma.registration.findMany({
      where: {
        riderId: userId,
        cancelledAt: null,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            routeLevel: true,
            startAt: true,
            estimatedMileage: true,
            status: true,
            leader: {
              select: {
                nickname: true,
              },
            },
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
      skip,
      take: pageSize,
    });
  }
}
