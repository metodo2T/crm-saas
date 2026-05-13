'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, KanbanData, LeadStatus } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CFG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NOVO:        { label: 'Novos',       color: 'text-blue-700',   bg: 'bg-blue-50'   },
  CONTATADO:   { label: 'Contatados',  color: 'text-amber-700',  bg: 'bg-amber-50'  },
  QUALIFICADO: { label: 'Qualificados',color: 'text-violet-700', bg: 'bg-violet-50' },
  CONVERTIDO:  { label: 'Convertidos', color: 'text-green-700',  bg: 'bg-green-50'  },
  DESCARTADO:  { label: 'Descartados', color: 'text-slate-500',  bg: 'bg-slate-100' },
};

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data, isLoading } = useQuery<KanbanData>({
    queryKey: ['leads', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
  });

  const allLeads = data ? Object.values(data).flat() : [];
  const total = allLeads.length;
  const converted = data?.CONVERTIDO.length ?? 0;
  const discarded = data?.DESCARTADO.length ?? 0;
  const active = total - discarded;
  const conversionRate = active > 0 ? Math.round((converted / active) * 100) : 0;

  const recentLeads = [...allLeads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">{organization?.name}</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {(['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO'] as LeadStatus[]).map((s) => {
          const cfg = STATUS_CFG[s];
          const count = data?.[s].length ?? 0;
          return (
            <div key={s} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{isLoading ? '—' : count}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Conversion rate */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Taxa de conversão</p>
          <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '—' : `${conversionRate}%`}</p>
          <p className="text-xs text-slate-400 mt-1">{converted} convertidos de {active} ativos</p>
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total de leads</p>
          <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '—' : total}</p>
          <Link href={`/${orgSlug}/leads`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
            Abrir kanban →
          </Link>
        </div>

        {/* Descartados */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Descartados</p>
          <p className="text-4xl font-bold text-slate-900 mt-1">{isLoading ? '—' : discarded}</p>
          <p className="text-xs text-slate-400 mt-1">fora do pipeline ativo</p>
        </div>
      </div>

      {/* Recent leads */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Atividade recente</h2>
          <Link href={`/${orgSlug}/leads`} className="text-xs text-blue-600 hover:underline">
            Ver todos os leads →
          </Link>
        </div>
        {isLoading ? (
          <div className="p-5 text-sm text-slate-400">Carregando...</div>
        ) : recentLeads.length === 0 ? (
          <div className="p-5 flex items-center gap-3">
            <span className="text-sm text-slate-500">Nenhum lead ainda.</span>
            <Link href={`/${orgSlug}/leads`} className="text-sm text-blue-600 hover:underline font-medium">
              Adicionar primeiro lead →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentLeads.map((lead) => {
              const cfg = STATUS_CFG[lead.status];
              return (
                <li key={lead.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-400 truncate">{lead.company || lead.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:block">
                      {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
