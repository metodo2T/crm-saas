import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resend: any = null;
  private fromDomain: string;
  private webUrl: string;

  constructor(private readonly config: ConfigService) {
    this.fromDomain = config.get('EMAIL_FROM_DOMAIN') ?? '';
    this.webUrl = config.get('WEB_URL') ?? 'http://localhost:3000';
    const key = config.get<string>('RESEND_API_KEY');
    if (key) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Resend } = require('resend');
        this.resend = new Resend(key);
        this.logger.log('Email notifications enabled (Resend)');
      } catch {
        this.logger.warn('resend package not installed — email notifications disabled. Run: pnpm add resend --filter api');
      }
    } else {
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled');
    }
  }

  private fromAddress(label: string): string {
    if (this.fromDomain) return `${label} <notificacoes@${this.fromDomain}>`;
    return 'onboarding@resend.dev';
  }

  async sendLeadCreated(opts: {
    to: string[];
    leadName: string;
    orgName: string;
    orgSlug: string;
    source: string;
    phone?: string | null;
    email?: string | null;
  }) {
    if (!this.resend || !opts.to.length) return;
    try {
      await this.resend.emails.send({
        from: this.fromAddress(`${opts.orgName} CRM`),
        to: opts.to,
        subject: `Novo lead: ${opts.leadName}`,
        html: this.leadCreatedHtml(opts),
      });
    } catch (err) {
      this.logger.error('Failed to send lead created email', err);
    }
  }

  async sendLeadAssigned(opts: {
    to: string;
    leadName: string;
    orgSlug: string;
  }) {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({
        from: this.fromAddress('CRM'),
        to: [opts.to],
        subject: `Lead atribuído a você: ${opts.leadName}`,
        html: this.leadAssignedHtml(opts),
      });
    } catch (err) {
      this.logger.error('Failed to send lead assigned email', err);
    }
  }

  private leadCreatedHtml(opts: { leadName: string; orgName: string; orgSlug: string; source: string; phone?: string | null; email?: string | null }) {
    const sourceLabel: Record<string, string> = { FORM: 'Formulário', WHATSAPP: 'WhatsApp', MANUAL: 'Manual', CSV: 'CSV' };
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b">
<h2 style="margin:0 0 4px">Novo lead chegou!</h2>
<p style="color:#64748b;margin:0 0 20px">No workspace <strong>${opts.orgName}</strong></p>
<table style="width:100%;border-collapse:collapse">
  <tr><td style="padding:8px 0;color:#64748b;width:100px">Nome</td><td style="padding:8px 0;font-weight:600">${opts.leadName}</td></tr>
  ${opts.email ? `<tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0">${opts.email}</td></tr>` : ''}
  ${opts.phone ? `<tr><td style="padding:8px 0;color:#64748b">Telefone</td><td style="padding:8px 0">${opts.phone}</td></tr>` : ''}
  <tr><td style="padding:8px 0;color:#64748b">Origem</td><td style="padding:8px 0">${sourceLabel[opts.source] ?? opts.source}</td></tr>
</table>
<a href="${this.webUrl}/${opts.orgSlug}/leads" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
  Ver leads →
</a>
</body></html>`;
  }

  private leadAssignedHtml(opts: { leadName: string; orgSlug: string }) {
    return `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1e293b">
<h2 style="margin:0 0 12px">Lead atribuído a você</h2>
<p>O lead <strong>${opts.leadName}</strong> foi atribuído a você.</p>
<a href="${this.webUrl}/${opts.orgSlug}/leads" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
  Ver leads →
</a>
</body></html>`;
  }
}
