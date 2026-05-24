import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const mockUser = {
  id: 'uuid-1',
  name: 'Nguyen Van A',
  email: 'test@example.com',
  role: 'USER' as const,
  emailVerified: false,
  createdAt: new Date('2026-05-24T00:00:00Z'),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

function makeMockResponse() {
  return {
    cookie: jest.fn(),
  } as unknown as Response;
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
      ],
      providers: [AuthService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates user and returns safe fields when email is new', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        name: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'secret123',
      });

      expect(result).toEqual(mockUser);

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 12);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Nguyen Van A',
            email: 'test@example.com',
            passwordHash: 'hashed_password',
            verificationToken: expect.any(String),
            verificationTokenExpiry: expect.any(Date),
          }),
          select: expect.objectContaining({
            id: true,
            name: true,
            email: true,
            role: true,
            emailVerified: true,
            createdAt: true,
          }),
        }),
      );

      // passwordHash must not be in the returned object
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws 409 ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-uuid' });

      await expect(
        service.register({
          name: 'Another User',
          email: 'test@example.com',
          password: 'secret123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('stores a verification token with a future expiry date', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const before = Date.now();
      await service.register({
        name: 'Nguyen Van A',
        email: 'test@example.com',
        password: 'secret123',
      });
      const after = Date.now();

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      const expiry: Date = createCall.data.verificationTokenExpiry;
      expect(expiry.getTime()).toBeGreaterThan(before);
      // expiry should be ~24 hours from now
      expect(expiry.getTime()).toBeGreaterThan(after + 23 * 60 * 60 * 1000);
    });
  });

  describe('login', () => {
    const verifiedUser = {
      id: 'uuid-1',
      name: 'Nguyen Van A',
      email: 'test@example.com',
      role: 'USER' as const,
      emailVerified: true,
      isActive: true,
      passwordHash: 'hashed_password',
    };

    it('sets access and refresh token cookies and returns safe user fields on correct credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = makeMockResponse();

      const result = await service.login({ email: verifiedUser.email, password: 'secret123' }, res);

      expect(res.cookie).toHaveBeenCalledWith('access_token', expect.any(String), expect.objectContaining({ httpOnly: true }));
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', expect.any(String), expect.objectContaining({ httpOnly: true }));
      expect(result).toEqual({
        id: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        role: verifiedUser.role,
        emailVerified: verifiedUser.emailVerified,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws 401 UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const res = makeMockResponse();

      await expect(
        service.login({ email: verifiedUser.email, password: 'wrong' }, res),
      ).rejects.toThrow(UnauthorizedException);

      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('throws 401 UnauthorizedException when email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const res = makeMockResponse();

      await expect(
        service.login({ email: 'nobody@example.com', password: 'secret123' }, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 UnauthorizedException when email is not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...verifiedUser, emailVerified: false });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const res = makeMockResponse();

      await expect(
        service.login({ email: verifiedUser.email, password: 'secret123' }, res),
      ).rejects.toThrow(UnauthorizedException);

      expect(res.cookie).not.toHaveBeenCalled();
    });
  });
});
