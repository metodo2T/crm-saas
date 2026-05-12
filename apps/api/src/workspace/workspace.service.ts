import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from '../common/base.service';

@Injectable()
export class WorkspaceService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async getWorkspace(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { plan: true, subscription: true },
    });
    if (!org) throw new NotFoundException('Workspace not found');
    return org;
  }

  async updateWorkspace(organizationId: string, data: { name?: string; logoUrl?: string }) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }

  async getMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(organizationId: string, callerUserId: string, targetUserId: string) {
    const callerMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: callerUserId } },
    });
    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can remove members');
    }
    return this.prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
  }
}
