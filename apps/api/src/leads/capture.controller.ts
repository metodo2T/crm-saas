import { Controller, Post, Body, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { CaptureRateLimitGuard } from './guards/capture-rate-limit.guard';
import { CaptureLeadDto } from './dto/capture-lead.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('leads')
export class CaptureController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post('capture')
  @UseGuards(CaptureRateLimitGuard)
  async capture(@Body() dto: CaptureLeadDto) {
    if (!dto.name) {
      throw new BadRequestException({ error: 'VALIDATION_ERROR', message: 'name required' });
    }
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({ error: 'VALIDATION_ERROR', message: 'email or phone required' });
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: dto.orgId },
      include: { subscription: true },
    });
    if (!org || !org.subscription ||
        (org.subscription.status !== 'ACTIVE' && org.subscription.status !== 'TRIALING')) {
      throw new NotFoundException({ error: 'ORG_NOT_FOUND' });
    }

    const { allowed } = await this.subscriptionService.checkLimit(dto.orgId, 'leads');
    if (!allowed) {
      const { TooManyRequestsException } = await import('@nestjs/common');
      throw new TooManyRequestsException({ error: 'PLAN_LIMIT_REACHED' });
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: dto.orgId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        status: 'NOVO',
        source: 'FORM',
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
        fbclid: dto.fbclid,
        gclid: dto.gclid,
      },
    });
    await this.subscriptionService.incrementUsage(dto.orgId, 'leads');
    return { id: lead.id };
  }
}
