import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get evolutionUrl(): string {
    return this.config.get<string>('EVOLUTION_API_URL', 'http://evolution:8080');
  }

  private get evolutionKey(): string {
    return this.config.get<string>('EVOLUTION_API_KEY', '');
  }

  private async evoFetch(path: string, options: RequestInit = {}): Promise<unknown> {
    const url = `${this.evolutionUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.evolutionKey,
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException(`Evolution API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async getInstance(organizationId: string) {
    return this.prisma.whatsAppInstance.findUnique({ where: { organizationId } });
  }

  async createInstance(organizationId: string) {
    const existing = await this.getInstance(organizationId);
    if (existing) return existing;

    const instanceName = `org_${organizationId.replace(/-/g, '').slice(0, 16)}`;

    await this.evoFetch('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: `${this.config.get('API_URL', 'http://api:3001')}/whatsapp/webhook`,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    });

    return this.prisma.whatsAppInstance.create({
      data: { organizationId, instanceName, status: 'CONNECTING' },
    });
  }

  async getQrCode(organizationId: string) {
    const instance = await this.getOrFail(organizationId);
    const data = await this.evoFetch(`/instance/connect/${instance.instanceName}`) as Record<string, unknown>;
    return { qrcode: data.qrcode ?? data.base64 ?? data.code };
  }

  async deleteInstance(organizationId: string) {
    const instance = await this.getInstance(organizationId);
    if (!instance) return;
    try {
      await this.evoFetch(`/instance/delete/${instance.instanceName}`, { method: 'DELETE' });
    } catch (e) {
      this.logger.warn(`Could not delete Evolution instance: ${e}`);
    }
    await this.prisma.whatsAppInstance.delete({ where: { organizationId } });
  }

  async getConversations(organizationId: string) {
    const instance = await this.getOrFail(organizationId);
    const messages = await this.prisma.whatsAppMessage.findMany({
      where: { instanceId: instance.id },
      orderBy: { timestamp: 'desc' },
      include: { lead: { select: { id: true, name: true, phone: true } } },
    });

    const convMap = new Map<string, {
      remoteJid: string;
      lead: { id: string; name: string; phone: string | null } | null;
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
      const conv = convMap.get(msg.remoteJid)!;
      if (!msg.fromMe && msg.status === 'SENT') conv.unread++;
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

  async sendMessage(organizationId: string, remoteJid: string, text: string) {
    const instance = await this.getOrFail(organizationId);
    if (instance.status !== 'CONNECTED') {
      throw new BadRequestException('WhatsApp not connected');
    }

    const data = await this.evoFetch(`/message/sendText/${instance.instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: remoteJid, text }),
    }) as Record<string, unknown>;

    const msgId = (data as any)?.key?.id ?? `manual_${Date.now()}`;
    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        OR: [
          { phone: remoteJid.split('@')[0] },
          { phone: `+${remoteJid.split('@')[0]}` },
        ],
      },
    });

    return this.prisma.whatsAppMessage.create({
      data: {
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
    const event = payload.event as string;
    const instanceName = payload.instance as string;

    const instance = await this.prisma.whatsAppInstance.findUnique({ where: { instanceName } });
    if (!instance) return;

    if (event === 'connection.update') {
      const state = (payload.data as any)?.state as string;
      const statusMap: Record<string, 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'> = {
        open: 'CONNECTED',
        connecting: 'CONNECTING',
        close: 'DISCONNECTED',
      };
      const newStatus = statusMap[state];
      if (newStatus) {
        const phone = (payload.data as any)?.me?.id?.split('@')[0] ?? null;
        await this.prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: { status: newStatus, ...(phone ? { phone } : {}) },
        });
      }
      return;
    }

    if (event === 'messages.upsert') {
      const messages = (payload.data as any)?.messages as Array<Record<string, unknown>> ?? [];
      for (const msg of messages) {
        const key = msg.key as any;
        const messageId = key?.id as string;
        if (!messageId) continue;

        const remoteJid = key?.remoteJid as string;
        const fromMe = key?.fromMe as boolean ?? false;
        const body =
          (msg.message as any)?.conversation ??
          (msg.message as any)?.extendedTextMessage?.text ?? '';
        const timestamp = new Date(((msg.messageTimestamp as number) ?? Date.now() / 1000) * 1000);

        const phone = remoteJid?.split('@')[0];
        let lead = await this.prisma.lead.findFirst({
          where: {
            organizationId: instance.organizationId,
            OR: [{ phone }, { phone: `+${phone}` }],
          },
        });

        if (!lead && !fromMe && body) {
          lead = await this.prisma.lead.create({
            data: {
              organizationId: instance.organizationId,
              name: phone,
              phone,
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
            status: fromMe ? 'SENT' : 'SENT',
            timestamp,
          },
        });
      }
    }
  }

  private async getOrFail(organizationId: string) {
    const instance = await this.getInstance(organizationId);
    if (!instance) throw new NotFoundException('WhatsApp instance not found');
    return instance;
  }
}
