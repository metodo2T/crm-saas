import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export abstract class BaseService {
  constructor(protected readonly prisma: PrismaService) {}

  /** Returns where clause with required organizationId */
  protected orgFilter(organizationId: string): { organizationId: string } {
    if (!organizationId) throw new ForbiddenException('Organization context missing');
    return { organizationId };
  }
}
