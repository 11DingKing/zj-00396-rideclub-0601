import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        phone: '13800138000',
        password: 'password123',
        nickname: 'testuser',
        role: UserRole.RIDER,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'test-id',
        phone: registerDto.phone,
        nickname: registerDto.nickname,
        role: registerDto.role,
        avatar: null,
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: registerDto.phone },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('test-token');
      expect(result.user).toBeDefined();
    });

    it('should throw ConflictException when phone already exists', async () => {
      const registerDto = {
        phone: '13800138000',
        password: 'password123',
        nickname: 'testuser',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        phone: registerDto.phone,
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const loginDto = {
        phone: '13800138000',
        password: 'password123',
      };

      const user = {
        id: 'test-id',
        phone: loginDto.phone,
        password: 'hashed-password',
        nickname: 'testuser',
        role: UserRole.RIDER,
        avatar: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('test-token');
      expect(result.user.phone).toBe(loginDto.phone);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const loginDto = {
        phone: '13800138000',
        password: 'password123',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const loginDto = {
        phone: '13800138000',
        password: 'wrong-password',
      };

      const user = {
        id: 'test-id',
        phone: loginDto.phone,
        password: 'hashed-password',
        nickname: 'testuser',
        role: UserRole.RIDER,
        avatar: null,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
