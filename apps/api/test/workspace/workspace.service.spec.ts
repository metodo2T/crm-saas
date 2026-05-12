import { Test } from '@nestjs/testing';
import { WorkspaceService } from '../../src/workspace/workspace.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(WorkspaceService);
    jest.clearAllMocks();
  });

  describe('getWorkspace', () => {
    it('returns workspace when found', async () => {
      const org = { id: 'org-1', name: 'Agência X', slug: 'agencia-x' };
      mockPrisma.organization.findUnique.mockResolvedValueOnce(org);
      const result = await service.getWorkspace('org-1');
      expect(result).toEqual(org);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        include: { plan: true, subscription: true },
      });
    });

    it('throws NotFoundException when org not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(service.getWorkspace('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMembers', () => {
    it('returns list of members with selected user fields', async () => {
      const members = [{ userId: 'u1', role: 'ADMIN', user: { id: 'u1', name: 'Ana', email: 'ana@example.com', avatarUrl: null } }];
      mockPrisma.organizationMember.findMany.mockResolvedValueOnce(members);
      const result = await service.getMembers('org-1');
      expect(mockPrisma.organizationMember.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });
      expect(result).toEqual(members);
    });
  });

  describe('removeMember', () => {
    it('removes member when caller is admin', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
      mockPrisma.organizationMember.delete.mockResolvedValueOnce({});
      await service.removeMember('org-1', 'caller-id', 'target-id');
      expect(mockPrisma.organizationMember.delete).toHaveBeenCalledWith({
        where: { organizationId_userId: { organizationId: 'org-1', userId: 'target-id' } },
      });
    });

    it('throws ForbiddenException when caller is not admin', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' });
      await expect(service.removeMember('org-1', 'caller-id', 'target-id')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller has no membership', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValueOnce(null);
      await expect(service.removeMember('org-1', 'caller-id', 'target-id')).rejects.toThrow(ForbiddenException);
    });
  });
});
