import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityStatus,
  RouteLevel,
  CheckpointType,
  CheckInStatus,
} from '@prisma/client';

describe('PointsService', () => {
  let service: PointsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: PrismaService,
          useValue: {
            activity: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              aggregate: jest.fn(),
            },
            pointsLog: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback({
              pointsLog: { create: jest.fn() },
              user: {
                findUnique: jest.fn(),
                update: jest.fn(),
              },
            })),
          },
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateLevel', () => {
    it('should return level 1 for less than 50 mileage', () => {
      const result = service['calculateLevel'](30);
      expect(result).toBe(1);
    });

    it('should return level 2 for 50-99 mileage', () => {
      const result = service['calculateLevel'](75);
      expect(result).toBe(2);
    });

    it('should return level 5 for 500-999 mileage', () => {
      const result = service['calculateLevel'](750);
      expect(result).toBe(5);
    });

    it('should return level 10 for 10000+ mileage', () => {
      const result = service['calculateLevel'](15000);
      expect(result).toBe(10);
    });
  });

  describe('addPoints', () => {
    it('should add points and update user stats', async () => {
      const mockTx = {
        pointsLog: { create: jest.fn() },
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-id',
            totalMileage: 100,
            totalRides: 5,
            level: 3,
          }),
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(mockTx));

      await service.addPoints(
        'user-id',
        'activity-id',
        'ACTIVITY_COMPLETION',
        50,
        30,
        '测试活动',
      );

      expect(mockTx.pointsLog.create).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: {
          totalMileage: 130,
          totalRides: 6,
          level: 3,
        },
      });
    });
  });

  describe('calculateAndDistributePoints', () => {
    it('should distribute points to completed riders', async () => {
      const mockActivity = {
        id: 'activity-id',
        title: '测试骑行',
        status: ActivityStatus.COMPLETED,
        actualMileage: 50,
        estimatedMileage: 50,
        routeLevel: RouteLevel.INTERMEDIATE,
        checkpoints: [
          { id: 'cp1', type: CheckpointType.START, orderIndex: 0 },
          { id: 'cp2', type: CheckpointType.SUPPLY, orderIndex: 1 },
          { id: 'cp3', type: CheckpointType.END, orderIndex: 2 },
        ],
        registrations: [
          {
            riderId: 'rider1',
            isPresent: true,
            checkIns: [
              {
                checkpointId: 'cp1',
                checkpoint: { type: CheckpointType.START },
                status: CheckInStatus.CHECKED_IN,
              },
              {
                checkpointId: 'cp2',
                checkpoint: { type: CheckpointType.SUPPLY },
                status: CheckInStatus.CHECKED_IN,
              },
              {
                checkpointId: 'cp3',
                checkpoint: { type: CheckpointType.END },
                status: CheckInStatus.CHECKED_IN,
              },
            ],
            violations: [],
          },
        ],
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(
        mockActivity,
      );

      const addPointsSpy = jest
        .spyOn(service, 'addPoints')
        .mockResolvedValue({ userId: 'rider1', points: 60, mileage: 50, newLevel: 3 });

      const result = await service.calculateAndDistributePoints('activity-id');

      expect(result.awardedCount).toBe(1);
      expect(result.totalParticipants).toBe(1);
      expect(addPointsSpy).toHaveBeenCalled();
    });
  });
});
