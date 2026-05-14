import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, Logger,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  constructor(private readonly wa: WhatsAppService) {}

  @Get('instance')
  @UseGuards(ClerkAuthGuard)
  getInstance(@CurrentOrg() orgId: string) {
    return this.wa.getInstance(orgId);
  }

  @Post('instance')
  @UseGuards(ClerkAuthGuard)
  async saveInstance(
    @CurrentOrg() orgId: string,
    @Body('instanceId') instanceId: string,
    @Body('token') token: string,
  ) {
    this.logger.log(`saveInstance org=${orgId} instanceId=${instanceId}`);
    try {
      const result = await this.wa.saveInstance(orgId, instanceId, token);
      this.logger.log(`saveInstance success status=${result.status}`);
      return result;
    } catch (e) {
      this.logger.error(`saveInstance error: ${e.message}`);
      throw e;
    }
  }

  @Post('instance/refresh')
  @UseGuards(ClerkAuthGuard)
  refreshStatus(@CurrentOrg() orgId: string) {
    return this.wa.refreshStatus(orgId);
  }

  @Get('instance/qr')
  @UseGuards(ClerkAuthGuard)
  getQrCode(@CurrentOrg() orgId: string) {
    return this.wa.getQrCode(orgId);
  }

  @Delete('instance')
  @UseGuards(ClerkAuthGuard)
  deleteInstance(@CurrentOrg() orgId: string) {
    return this.wa.deleteInstance(orgId);
  }

  @Get('conversations')
  @UseGuards(ClerkAuthGuard)
  getConversations(@CurrentOrg() orgId: string) {
    return this.wa.getConversations(orgId);
  }

  @Get('conversations/:jid/messages')
  @UseGuards(ClerkAuthGuard)
  getMessages(@CurrentOrg() orgId: string, @Param('jid') jid: string) {
    return this.wa.getMessages(orgId, decodeURIComponent(jid));
  }

  @Post('conversations/:jid/messages')
  @UseGuards(ClerkAuthGuard)
  sendMessage(
    @CurrentOrg() orgId: string,
    @Param('jid') jid: string,
    @Body('text') text: string,
  ) {
    const phone = decodeURIComponent(jid).split('@')[0];
    return this.wa.sendMessage(orgId, phone, text);
  }

  @Patch('conversations/:jid/lead')
  @UseGuards(ClerkAuthGuard)
  linkLead(
    @CurrentOrg() orgId: string,
    @Param('jid') jid: string,
    @Body('leadId') leadId: string | null,
  ) {
    return this.wa.linkLead(orgId, decodeURIComponent(jid), leadId ?? null);
  }

  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Body() payload: Record<string, unknown>) {
    return this.wa.handleWebhook(payload);
  }
}
