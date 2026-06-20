import { Test, TestingModule } from '@nestjs/testing';
import { ViolationsService } from './violations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ViolationType, ActivityStatus } from '@prisma/client';

describe('ViolationsService', () => {
  let service: ViolationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViolationsService,
        {
          provide: PrismaService,
          useValue: {
            activity: {
              findUnique: jest.fn(),
            },
            registration: {
              findUnique: jest.fn(),
            },
            violation: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback({
              violation: { create: jest.fn() },
              user: { update: jest.fn() },
            })),
          },
        },
      ],
    }).compile();

    service = module.get<ViolationsService>(ViolationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('violation points', () => {
    it('should deduct correct points for NO_HELMET violation', async () => {
      const mockActivity = {
        id: 'activity-id',
        leaderId: 'leader-id',
        title: '测试活动',
      };

      const mockRegistration = {
        id: 'reg-id',
        activityId: 'activity-id',
        riderId: 'rider-id',
        cancelledAt: null,
      };

      const mockTx = {
        violation: {
          create: jest.fn().mockResolvedValue({
            id: 'violation-id',
            type: ViolationType.NO_HELMET,
            pointsDeducted: 15,
          }),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(
        mockActivity,
      );
      (prisma.registration.findUnique as jest.Mock).mockResolvedValue(
        mockRegistration,
      );
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(mockTx));

      await service.create(
        'activity-id',
        'rider-id',
        'leader-id',
        {
          type: ViolationType.NO_HELMET,
          description: '未佩戴头盔',
        },
      );

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'rider-id' },
        data: {
          safetyScore: {
            decrement: 15,
          },
        },
      });
    });

    it('should deduct correct points for NO_LIGHTS_NIGHT_RIDE violation', async () => {
      const mockActivity = {
        id: 'activity-id',
        leaderId: 'leader-id',
        title: '测试夜骑',
      };

      const mockRegistration = {
        id: 'reg-id',
        activityId: 'activity-id',
        riderId: 'rider-id',
        cancelledAt: null,
      };

      const mockTx = {
        violation: {
          create: jest.fn().mockResolvedValue({
            id: 'violation-id',
            type: ViolationType.NO_LIGHTS_NIGHT_RIDE,
            pointsDeducted: 10,
          }),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(
        mockActivity,
      );
      (prisma.registration.findUnique as jest.Mock).mockResolvedValue(
        mockRegistration,
      );
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(mockTx));

      await service.create(
        'activity-id',
        'rider-id',
        'leader-id',
        {
          type: ViolationType.NO_LIGHTS_NIGHT_RIDE,
          description: '夜骑未带灯',
        },
      );

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'rider-id' },
        data: {
          safetyScore: {
            decrement: 10,
          },
        },
      });
    });
  });

  describe('create', () => {
    it('should create a violation and deduct safety points', async () => {
      const mockActivity = {
        id: 'activity-id',
        leaderId: 'leader-id',
        title: '测试活动',
      };

      const mockRegistration = {
        id: 'reg-id',
        activityId: 'activity-id',
        riderId: 'rider-id',
        cancelledAt: null,
      };

      const mockTx = {
        violation: {
          create: jest.fn().mockResolvedValue({
            id: 'violation-id',
            type: ViolationType.NO_HELMET,
            pointsDeducted: 15,
          }),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.activity.findUnique as jest.Mock).mockResolvedValue(
        mockActivity,
      );
      (prisma.registration.findUnique as jest.Mock).mockResolvedValue(
        mockRegistration,
      );
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(mockTx));

      const result = await service.create(
        'activity-id',
        'rider-id',
        'leader-id',
        {
          type: ViolationType.NO_HELMET,
          description: '未佩戴头盔',
        },
      );

      expect(mockTx.violation.create).toHaveBeenCalled();
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'rider-id' },
        data: {
          safetyScore: {
            decrement: 15,
          },
        },
      });
    });
  });
});
