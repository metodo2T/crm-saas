'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Lead, LeadStatus, updateLeadStatus, deleteLead } from '@/lib/api/leads';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: 'Novo',
  CONTATADO: 'Contatado',
  QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido',
  DESCARTADO: 'Descartado',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOVO: 'bg-blue-50 text-blue-700',
  CONTATADO: 'bg-amber-50 text-amber-700',
  QUALIFICADO: 'bg-violet-50 text-violet-700',
  CONVERTIDO: 'bg-green-50 text-green-700',
  DESCARTADO: 'bg-slate-100 text-slate-500',
};

const ALL_STATUSES: LeadStatus[] = ['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO', 'DESCARTADO'];

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

export function LeadSlideOver({ lead, open, onClose }: Props) {
  const [showUtms, setShowUtms] = useState(false);
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const statusMutation = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const token = await getToken();
      return updateLeadStatus(token!, lead!.id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteLead(token!, lead!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      onClose();
    },
  });

  if (!lead) return null;

  const hasUtms = lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.fbclid || lead.gclid;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] bg-white border-slate-200 text-slate-900">
        <SheetHeader>
          <SheetTitle className="text-slate-900 text-xl">{lead.name}</SheetTitle>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded font-semibold ${STATUS_COLORS[lead.status]}`}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-2 text-sm text-slate-700 px-6">
          {lead.email && (
            <p className="flex items-center gap-2"><span className="text-slate-400">Email</span>{lead.email}</p>
          )}
          {lead.phone && (
            <p className="flex items-center gap-2"><span className="text-slate-400">Telefone</span>{lead.phone}</p>
          )}
          {lead.company && (
            <p className="flex items-center gap-2"><span className="text-slate-400">Empresa</span>{lead.company}</p>
          )}
          {lead.notes && (
            <p className="text-slate-500 text-xs mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">{lead.notes}</p>
          )}
        </div>

        {hasUtms && (
          <div className="mt-4 px-6">
            <button
              onClick={() => setShowUtms(!showUtms)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showUtms ? '▲ Ocultar rastreamento' : '▼ Ver UTMs / rastreamento'}
            </button>
            {showUtms && (
              <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1 font-mono border border-slate-100">
                {lead.utmSource && <p>utm_source: {lead.utmSource}</p>}
                {lead.utmMedium && <p>utm_medium: {lead.utmMedium}</p>}
                {lead.utmCampaign && <p>utm_campaign: {lead.utmCampaign}</p>}
                {lead.utmContent && <p>utm_content: {lead.utmContent}</p>}
                {lead.utmTerm && <p>utm_term: {lead.utmTerm}</p>}
                {lead.fbclid && <p>fbclid: {lead.fbclid}</p>}
                {lead.gclid && <p>gclid: {lead.gclid}</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 px-6">
          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Mover para</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.filter((s) => s !== lead.status && lead.status !== 'CONVERTIDO').map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => statusMutation.mutate(s)}
                disabled={statusMutation.isPending}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>

        {lead.phone && (
          <div className="mt-4 px-6">
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">WhatsApp</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => {
                const jid = `${lead.phone!.replace(/\D/g, '')}@s.whatsapp.net`;
                router.push(`/${orgSlug}/whatsapp?jid=${encodeURIComponent(jid)}`);
                onClose();
              }}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Conversar no WhatsApp
            </Button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 px-6">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-xs"
          >
            Descartar lead
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
