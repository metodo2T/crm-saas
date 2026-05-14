import { Controller, Post, Req, Body, BadRequestException } from '@nestjs/common';
import { Webhook } from 'svix';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from '../deals/pipeline.service';

@Controller('webhooks/clerk')
export class ClerkWebhookController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly pipelineService: PipelineService,
  ) {}

  @Post()
  async handleClerkWebhook(
    @Req() req: any,
    @Body() _body: unknown,
  ) {
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string;
    const svixSignature = req.headers['svix-signature'] as string;

    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
    let event: any;

    try {
      event = wh.verify(req.rawBody?.toString() ?? '', {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { type, data } = event;

    if (type === 'user.created' || type === 'user.updated') {
      await this.usersService.upsertFromClerk(data);
    }

    if (type === 'organization.created') {
      const starterPlan = await this.prisma.plan.findFirstOrThrow({ where: { name: 'STARTER' } });
      const org = await this.prisma.organization.upsert({
        where: { clerkOrgId: data.id },
        update: { name: data.name, slug: data.slug },
        create: {
          clerkOrgId: data.id,
          name: data.name,
          slug: data.slug,
          planId: starterPlan.id,
        },
      });
      await this.prisma.subscription.upsert({
        where: { organizationId: org.id },
        update: {},
        create: {
          organizationId: org.id,
          planId: starterPlan.id,
          stripeSubId: `trial_${org.id}`,
          stripeCustomerId: `trial_cus_${org.id}`,
          status: 'TRIALING',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await this.pipelineService.createDefaultPipeline(org.id);
    }

    if (type === 'organizationMembership.created') {
      const [org, user] = await Promise.all([
        this.prisma.organization.findFirst({ where: { clerkOrgId: data.organization.id } }),
        this.prisma.user.findUnique({ where: { clerkUserId: data.public_user_data.user_id } }),
      ]);
      if (!org || !user) {
        throw new BadRequestException('Organization or user not found — will retry');
      }
      await this.prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: data.role === 'org:admin' ? 'ADMIN' : 'MEMBER',
        },
      });
    }

    if (type === 'organizationMembership.deleted') {
      const [org, user] = await Promise.all([
        this.prisma.organization.findFirst({ where: { clerkOrgId: data.organization.id } }),
        this.prisma.user.findUnique({ where: { clerkUserId: data.public_user_data.user_id } }),
      ]);
      if (!org || !user) {
        return { received: true };
      }
      await this.prisma.organizationMember.deleteMany({
        where: { organizationId: org.id, userId: user.id },
      });
    }

    return { received: true };
  }
}
