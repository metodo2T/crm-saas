import { Test } from '@nestjs/testing';
import { UsersService } from '../../src/users/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';

const mockPrisma = {
  user: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('upsertFromClerk', () => {
    it('creates a new user with correct data', async () => {
      const clerkData = {
        id: 'user_abc',
        emailAddresses: [{ emailAddress: 'a@b.com' }],
        firstName: 'Ana',
        lastName: 'Silva',
        imageUrl: null,
      };
      mockPrisma.user.upsert.mockResolvedValueOnce({ id: 'db-uuid', clerkUserId: 'user_abc' });

      const result = await service.upsertFromClerk(clerkData);

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { clerkUserId: 'user_abc' },
        update: { email: 'a@b.com', name: 'Ana Silva', avatarUrl: null },
        create: { clerkUserId: 'user_abc', email: 'a@b.com', name: 'Ana Silva', avatarUrl: null },
      });
      expect(result.clerkUserId).toBe('user_abc');
    });
  });

  describe('findByClerkId', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'uuid', clerkUserId: 'user_abc' });
      const result = await service.findByClerkId('user_abc');
      expect(result?.clerkUserId).toBe('user_abc');
    });
  });
});
