import { Test } from '@nestjs/testing';
import { LeadsService } from '../../src/leads/leads.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SubscriptionService } from '../../src/subscription/subscription.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  lead: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockSubscription = {
  checkLimit: jest.fn(),
  incrementUsage: jest.fn(),
};

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SubscriptionService, useValue: mockSubscription },
      ],
    }).compile();
    service = module.get(LeadsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates lead and increments usage counter', async () => {
      const lead = { id: 'lead-1', name: 'João', organizationId: 'org-1', source: 'MANUAL' };
      mockPrisma.lead.create.mockResolvedValueOnce(lead);
      const result = await service.create('org-1', {
        name: 'João', phone: '11999', source: 'MANUAL',
      });
      expect(mockPrisma.lead.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: 'org-1', name: 'João', source: 'MANUAL' }),
      });
      expect(mockSubscription.incrementUsage).toHaveBeenCalledWith('org-1', 'leads');
      expect(result).toEqual(lead);
    });

    it('throws BadRequestException when neither email nor phone provided', async () => {
      await expect(
        service.create('org-1', { name: 'João', source: 'MANUAL' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('returns lead when found in org', async () => {
      const lead = { id: 'lead-1', organizationId: 'org-1', name: 'João' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      const result = await service.findOne('org-1', 'lead-1');
      expect(result).toEqual(lead);
    });

    it('throws NotFoundException when lead not in org', async () => {
      mockPrisma.lead.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('org-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates status and sets convertedAt when CONVERTIDO', async () => {
      const lead = { id: 'lead-1', organizationId: 'org-1', status: 'QUALIFICADO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'CONVERTIDO', convertedAt: new Date() });
      await service.updateStatus('org-1', 'lead-1', { status: 'CONVERTIDO' });
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONVERTIDO', convertedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws ForbiddenException when trying to change status of CONVERTIDO lead', async () => {
      const lead = { id: 'lead-1', status: 'CONVERTIDO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      await expect(service.updateStatus('org-1', 'lead-1', { status: 'NOVO' })).rejects.toThrow(ForbiddenException);
    });

    it('does not set convertedAt when status is not CONVERTIDO', async () => {
      const lead = { id: 'lead-1', status: 'NOVO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'CONTATADO' });
      await service.updateStatus('org-1', 'lead-1', { status: 'CONTATADO' });
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONTATADO' }),
        }),
      );
      const call = mockPrisma.lead.update.mock.calls[0][0];
      expect(call.data.convertedAt).toBeUndefined();
    });
  });

  describe('softDelete', () => {
    it('sets status to DESCARTADO', async () => {
      const lead = { id: 'lead-1', status: 'NOVO' };
      mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
      mockPrisma.lead.update.mockResolvedValueOnce({ ...lead, status: 'DESCARTADO' });
      await service.softDelete('org-1', 'lead-1');
      expect(mockPrisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'DESCARTADO' } }),
      );
    });
  });

  describe('getKanban', () => {
    it('returns leads grouped by status', async () => {
      const leads = [
        { id: '1', status: 'NOVO', name: 'João' },
        { id: '2', status: 'NOVO', name: 'Carla' },
        { id: '3', status: 'CONTATADO', name: 'Bruno' },
      ];
      mockPrisma.lead.findMany.mockResolvedValueOnce(leads);
      const result = await service.getKanban('org-1');
      expect(result.NOVO).toHaveLength(2);
      expect(result.CONTATADO).toHaveLength(1);
      expect(result.QUALIFICADO).toHaveLength(0);
      expect(result.CONVERTIDO).toHaveLength(0);
      expect(result.DESCARTADO).toHaveLength(0);
    });
  });
});
