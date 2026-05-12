import { Test } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';

jest.mock('@prisma/client', () => {
  const mockPrismaClient = jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    organization: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    plan: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    subscription: { findMany: jest.fn(), findUnique: jest.fn() },
    auditLog: { findMany: jest.fn(), create: jest.fn() },
    organizationMember: { findMany: jest.fn(), create: jest.fn() },
  }));
  return { PrismaClient: mockPrismaClient };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose prisma client methods', () => {
    expect(typeof service.organization.findMany).toBe('function');
    expect(typeof service.user.findMany).toBe('function');
  });
});
