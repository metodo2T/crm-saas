'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { linkWaLead, WaConversation } from '@/lib/api/whatsapp';
import { searchLeads, Lead } from '@/lib/api/leads';
import { NewLeadSheet } from '@/app/[orgSlug]/leads/_components/new-lead-sheet';

type LinkedLead = NonNullable<WaConversation['lead']>;

interface Props {
  jid: string;
  lead: LinkedLead | null;
  onLinkChange: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido', DESCARTADO: 'Descartado',
};

const STATUS_COLORS: Record<string, string> = {
  NOVO:        'bg-blue-950 text-blue-400',
  CONTATADO:   'bg-amber-950 text-amber-400',
  QUALIFICADO: 'bg-violet-950 text-violet-400',
  CONVERTIDO:  'bg-emerald-950 text-emerald-400',
  DESCARTADO:  'bg-slate-800 text-slate-500',
};

export function WaLeadPanel({ jid, lead, onLinkChange }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults } = useQuery({
    queryKey: ['leads', 'search', debouncedSearch],
    queryFn: async () => {
      const token = await getToken();
      return searchLeads(token!, debouncedSearch);
    },
    enabled: debouncedSearch.length > 1 && !lead,
  });

  const linkMutation = useMutation({
    mutationFn: async (leadId: string | null) => {
      const token = await getToken();
      return linkWaLead(token!, jid, leadId);
    },
    onSuccess: () => {
      setSearch('');
      onLinkChange();
    },
  });

  const phone = jid.split('@')[0];

  return (
    <div className="w-64 border-l border-[#334155] bg-[#1e293b] flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-[#334155]">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</p>
      </div>

      {lead ? (
        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">{lead.name}</p>
            <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLORS[lead.status] ?? 'bg-slate-800 text-slate-500'}`}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </span>
          </div>
          {lead.email && <p className="text-xs text-slate-500 truncate">{lead.email}</p>}
          {lead.phone && <p className="text-xs text-slate-500">{lead.phone}</p>}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => router.push(`/${orgSlug}/leads`)}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-[#334155] text-slate-400 hover:bg-[#334155] transition-colors flex items-center gap-1.5"
            >
              <span>↗</span> Ver no kanban
            </button>
            <button
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
              className="w-full text-left text-xs px-3 py-2 rounded-lg border border-red-900 text-red-400 hover:bg-red-950 transition-colors disabled:opacity-50"
            >
              Desvincular lead
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-3 flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-[#334155] bg-[#0f172a] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {searchResults && searchResults.items.length > 0 && (
            <div className="space-y-1">
              {searchResults.items.map((l: Lead) => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[#334155]/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-300 truncate">{l.name}</p>
                    <p className="text-[11px] text-slate-600 truncate">{l.phone ?? l.email ?? ''}</p>
                  </div>
                  <button
                    onClick={() => linkMutation.mutate(l.id)}
                    disabled={linkMutation.isPending}
                    className="ml-2 text-[11px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 shrink-0 disabled:opacity-50"
                  >
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {debouncedSearch.length > 1 && searchResults?.items.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-2">Nenhum lead encontrado</p>
          )}

          <button
            onClick={() => setNewLeadOpen(true)}
            className="w-full text-xs px-3 py-2 rounded-lg border border-dashed border-indigo-800 text-indigo-400 hover:bg-indigo-950 transition-colors"
          >
            + Criar lead desta conversa
          </button>
        </div>
      )}

      <NewLeadSheet
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        defaultPhone={phone}
        defaultSource="WHATSAPP"
        onCreated={(newLead) => linkMutation.mutate(newLead.id)}
      />
    </div>
  );
}
