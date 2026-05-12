import { ForbiddenException } from '@nestjs/common';
import { BaseService } from '../../src/common/base.service';
import { PrismaService } from '../../src/prisma/prisma.service';

class ConcreteService extends BaseService {
  constructor(prisma: PrismaService) { super(prisma); }
  testFilter(id: string | undefined) { return this.orgFilter(id); }
}

const mockPrisma = {} as PrismaService;

describe('BaseService', () => {
  let service: ConcreteService;
  beforeEach(() => { service = new ConcreteService(mockPrisma); });

  it('returns orgFilter object for valid id', () => {
    expect(service.testFilter('org-1')).toEqual({ organizationId: 'org-1' });
  });

  it('throws ForbiddenException for empty string', () => {
    expect(() => service.testFilter('')).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for undefined', () => {
    expect(() => service.testFilter(undefined)).toThrow(ForbiddenException);
  });
});
