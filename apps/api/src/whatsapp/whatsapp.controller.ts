import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get('instance')
  @UseGuards(ClerkAuthGuard)
  getInstance(@CurrentOrg() orgId: string) {
    return this.wa.getInstance(orgId);
  }

  @Post('instance')
  @UseGuards(ClerkAuthGuard)
  saveInstance(
    @CurrentOrg() orgId: string,
    @Body('instanceId') instanceId: string,
    @Body('token') token: string,
  ) {
    return this.wa.saveInstance(orgId, instanceId, token);
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

  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Body() payload: Record<string, unknown>) {
    return this.wa.handleWebhook(payload);
  }
}
