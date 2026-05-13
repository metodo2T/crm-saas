'use client';
import { useState } from 'react';
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
