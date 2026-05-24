import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
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
});
