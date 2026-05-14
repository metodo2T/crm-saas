import { Test } from '@nestjs/testing';
import { WhatsAppService } from '../../src/whatsapp/whatsapp.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  whatsAppInstance: { findUnique: jest.fn() },
  whatsAppMessage: { updateMany: jest.fn() },
  lead: { findFirst: jest.fn() },
};

const mockConfig = { get: jest.fn().mockReturnValue('') };

describe('WhatsAppService.linkLead', () => {
  let service: WhatsAppService;

  const instance = {
    id: 'inst-1', instanceName: 'abc', token: 'tok',
    status: 'CONNECTED', organizationId: 'org-1', phone: null,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(WhatsAppService);
    jest.clearAllMocks();
  });

  it('links a lead — updates all messages of the remoteJid', async () => {
    const lead = { id: 'lead-1', name: 'João', email: 'j@ex.com', phone: '11999', status: 'NOVO', source: 'WHATSAPP' };
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.lead.findFirst.mockResolvedValueOnce(lead);
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await service.linkLead('org-1', '11999@s.whatsapp.net', 'lead-1');

    expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
      where: { id: 'lead-1', organizationId: 'org-1' },
    });
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { instanceId: 'inst-1', remoteJid: '11999@s.whatsapp.net' },
      data: { leadId: 'lead-1' },
    });
    expect(result.lead).toEqual(lead);
  });

  it('unlinks — sets leadId to null without querying lead table', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.whatsAppMessage.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.linkLead('org-1', '11999@s.whatsapp.net', null);

    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.whatsAppMessage.updateMany).toHaveBeenCalledWith({
      where: { instanceId: 'inst-1', remoteJid: '11999@s.whatsapp.net' },
      data: { leadId: null },
    });
    expect(result.lead).toBeNull();
  });

  it('throws NotFoundException when leadId does not belong to org', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(instance);
    mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.linkLead('org-1', '11999@s.whatsapp.net', 'bad-lead'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when WhatsApp instance is not configured', async () => {
    mockPrisma.whatsAppInstance.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.linkLead('org-1', '11999@s.whatsapp.net', 'lead-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
