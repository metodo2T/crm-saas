import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const ZAPI_BASE = 'https://api.z-api.io';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get clientToken(): string {
    return this.config.get<string>('ZAPI_CLIENT_TOKEN', '');
  }

  private zapiUrl(instanceId: string, token: string, path: string): string {
    return `${ZAPI_BASE}/instances/${instanceId}/token/${token}${path}`;
  }

  private async zapiGet(instanceId: string, token: string, path: string): Promise<unknown> {
    const url = this.zapiUrl(instanceId, token, path);
    const res = await fetch(url, {
      headers: { 'Client-Token': this.clientToken },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('image')) {
      const buf = await res.arrayBuffer();
      return { base64: `data:image/png;base64,${Buffer.from(buf).toString('base64')}` };
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  private async zapiPost(instanceId: string, token: string, path: string, body: unknown): Promise<unknown> {
    const url = this.zapiUrl(instanceId, token, path);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': this.clientToken },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`Z-API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async getInstance(organizationId: string) {
    return this.prisma.whatsAppInstance.findUnique({ where: { organizationId } });
  }

  async saveInstance(organizationId: string, instanceId: string, token: string) {
    const status = await this.fetchRemoteStatus(instanceId, token);
    const waStatus = status.connected ? 'CONNECTED' : 'DISCONNECTED';
    const phone = status.connectedPhone ?? null;

    return this.prisma.whatsAppInstance.upsert({
      where: { organizationId },
      update: { instanceName: instanceId, token, status: waStatus, phone },
      create: { organizationId, instanceName: instanceId, token, status: waStatus, phone },
    });
  }

  async refreshStatus(organizationId: string) {
    const instance = await this.getOrFail(organizationId);
    const status = await this.fetchRemoteStatus(instance.instanceName, instance.token!);
    const waStatus = status.connected ? 'CONNECTED' : 'DISCONNECTED';
    return this.prisma.whatsAppInstance.update({
      where: { organizationId },
      data: { status: waStatus, phone: status.connectedPhone ?? instance.phone },
    });
  }

  async getQrCode(organizationId: string) {
    const instance = await this.getOrFail(organizationId);
    const data = await this.zapiGet(instance.instanceName, instance.token!, '/qr-code/image') as Record<string, unknown>;
    return data;
  }

  async deleteInstance(organizationId: string) {
    await this.prisma.whatsAppInstance.delete({ where: { organizationId } }).catch(() => null);
  }

  async getConversations(organizationId: string) {
    const instance = await this.getOrFail(organizationId);
    const messages = await this.prisma.whatsAppMessage.findMany({
      where: { instanceId: instance.id },
      orderBy: { timestamp: 'desc' },
      include: { lead: { select: { id: true, name: true, phone: true, email: true, status: true } } },
    });

    const convMap = new Map<string, {
      remoteJid: string;
      lead: { id: string; name: string; phone: string | null; email: string | null; status: string } | null;
      lastMessage: string;
      lastTimestamp: Date;
      unread: number;
    }>();

    for (const msg of messages) {
      if (!convMap.has(msg.remoteJid)) {
        convMap.set(msg.remoteJid, {
          remoteJid: msg.remoteJid,
          lead: msg.lead ?? null,
          lastMessage: msg.body,
          lastTimestamp: msg.timestamp,
          unread: 0,
        });
      }
      if (!msg.fromMe && msg.status === 'SENT') {
        convMap.get(msg.remoteJid)!.unread++;
      }
    }

    return Array.from(convMap.values());
  }

  async getMessages(organizationId: string, remoteJid: string) {
    const instance = await this.getOrFail(organizationId);
    return this.prisma.whatsAppMessage.findMany({
      where: { instanceId: instance.id, remoteJid },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
  }

  async sendMessage(organizationId: string, phone: string, text: string) {
    const instance = await this.getOrFail(organizationId);
    if (instance.status !== 'CONNECTED') {
      throw new BadRequestException('WhatsApp not connected');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const data = await this.zapiPost(instance.instanceName, instance.token!, '/send-text', {
      phone: cleanPhone,
      message: text,
    }) as Record<string, unknown>;

    const msgId = (data as any)?.zaapId ?? (data as any)?.messageId ?? `manual_${Date.now()}`;
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;

    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        OR: [{ phone: cleanPhone }, { phone: `+${cleanPhone}` }],
      },
    });

    return this.prisma.whatsAppMessage.upsert({
      where: { messageId: msgId },
      update: {},
      create: {
        instanceId: instance.id,
        leadId: lead?.id ?? null,
        remoteJid,
        fromMe: true,
        body: text,
        messageId: msgId,
        status: 'SENT',
        timestamp: new Date(),
      },
    });
  }

  async handleWebhook(payload: Record<string, unknown>) {
    const instanceId = payload.instanceId as string;
    if (!instanceId) return;

    const instance = await this.prisma.whatsAppInstance.findUnique({
      where: { instanceName: instanceId },
    });
    if (!instance) return;

    // Connection status update
    if ('connected' in payload) {
      const connected = payload.connected as boolean;
      const phone = (payload.connectedPhone as string) ?? instance.phone;
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: connected ? 'CONNECTED' : 'DISCONNECTED',
          ...(phone ? { phone } : {}),
        },
      });
      return;
    }

    // Incoming/outgoing message
    const messageId = payload.messageId as string;
    if (!messageId) return;

    const type = payload.type as string;
    const isText = type === 'TEXT' || type === 'text';
    if (!isText) return;

    const body = (payload.text as any)?.message ?? (payload.text as string) ?? '';
    const fromMe = payload.fromMe as boolean ?? false;
    const phone = payload.phone as string;
    if (!phone) return;

    const cleanPhone = phone.replace(/\D/g, '');
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;
    const timestamp = new Date((payload.momment as number) ?? Date.now());
    const senderName = (payload.senderName as string) ?? (payload.chatName as string) ?? cleanPhone;

    let lead = await this.prisma.lead.findFirst({
      where: {
        organizationId: instance.organizationId,
        OR: [{ phone: cleanPhone }, { phone: `+${cleanPhone}` }],
      },
    });

    if (!lead && !fromMe && body) {
      lead = await this.prisma.lead.create({
        data: {
          organizationId: instance.organizationId,
          name: senderName,
          phone: cleanPhone,
          source: 'WHATSAPP',
          status: 'NOVO',
        },
      });
    }

    await this.prisma.whatsAppMessage.upsert({
      where: { messageId },
      update: {},
      create: {
        instanceId: instance.id,
        leadId: lead?.id ?? null,
        remoteJid,
        fromMe,
        body,
        messageId,
        status: 'SENT',
        timestamp,
      },
    });
  }

  async linkLead(
    organizationId: string,
    remoteJid: string,
    leadId: string | null,
  ): Promise<{ lead: { id: string; name: string; email: string | null; phone: string | null; status: string; source: string } | null }> {
    const instance = await this.getOrFail(organizationId);

    let lead = null;
    if (leadId !== null) {
      lead = await this.prisma.lead.findFirst({
        where: { id: leadId, organizationId },
        select: { id: true, name: true, email: true, phone: true, status: true, source: true },
      });
      if (!lead) throw new NotFoundException('Lead not found');
    }

    await this.prisma.whatsAppMessage.updateMany({
      where: { instanceId: instance.id, remoteJid },
      data: { leadId },
    });

    return { lead };
  }

  private async fetchRemoteStatus(instanceId: string, token: string): Promise<{ connected: boolean; connectedPhone?: string }> {
    try {
      const data = await this.zapiGet(instanceId, token, '/status') as Record<string, unknown>;
      return {
        connected: data.connected === true,
        connectedPhone: data.connectedPhone as string | undefined,
      };
    } catch {
      return { connected: false };
    }
  }

  private async getOrFail(organizationId: string) {
    const instance = await this.getInstance(organizationId);
    if (!instance || !instance.token) throw new NotFoundException('WhatsApp instance not configured');
    return instance;
  }
}
