import { Test } from '@nestjs/testing';
import { ClerkWebhookController } from '../../src/webhooks/clerk-webhook.controller';
import { UsersService } from '../../src/users/users.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

jest.mock('svix');

const mockUsersService = { upsertFromClerk: jest.fn() };
const mockPrisma = {
  organization: { create: jest.fn() },
  plan: { findFirstOrThrow: jest.fn() },
  organizationMember: { create: jest.fn(), deleteMany: jest.fn() },
  user: { findUnique: jest.fn() },
};

describe('ClerkWebhookController', () => {
  let controller: ClerkWebhookController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ClerkWebhookController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    controller = module.get(ClerkWebhookController);
    jest.clearAllMocks();
  });

  it('throws BadRequestException when svix signature invalid', async () => {
    const svix = require('svix');
    svix.Webhook.mockImplementation(() => ({
      verify: jest.fn().mockImplementation(() => { throw new Error('invalid'); }),
    }));

    const req = { headers: {}, rawBody: Buffer.from('{}') } as any;
    await expect(controller.handleClerkWebhook(req, {})).rejects.toThrow(BadRequestException);
  });
});
