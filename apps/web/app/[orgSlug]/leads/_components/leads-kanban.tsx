'use client';
import { useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, updateLeadStatus, bulkAction, Lead, LeadStatus, KanbanData } from '@/lib/api/leads';
import { LeadCard } from './lead-card';
import { LeadSlideOver } from './lead-slide-over';
import { Button } from '@/components/ui/button';

const COLUMNS: { key: LeadStatus; label: string; color: string; dot: string }[] = [
  { key: 'NOVO', label: 'Novo', color: 'text-blue-700', dot: 'bg-blue-500' },
  { key: 'CONTATADO', label: 'Contatado', color: 'text-amber-700', dot: 'bg-amber-500' },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'text-violet-700', dot: 'bg-violet-500' },
  { key: 'CONVERTIDO', label: 'Convertido', color: 'text-green-700', dot: 'bg-green-500' },
  { key: 'DESCARTADO', label: 'Descartado', color: 'text-slate-500', dot: 'bg-slate-400' },
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOVO: 'Novo', CONTATADO: 'Contatado', QUALIFICADO: 'Qualificado',
  CONVERTIDO: 'Convertido', DESCARTADO: 'Descartado',
};

interface Props {
  selectionMode: boolean;
}

export function LeadsKanban({ selectionMode }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    refetchInterval: 30_000,
    enabled: !!organization?.id,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const token = await getToken();
      return updateLeadStatus(token!, id, status);
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['leads', 'kanban', organization?.id] });
      const prev = queryClient.getQueryData<KanbanData>(['leads', 'kanban', organization?.id]);
      if (prev) {
        const updated: KanbanData = {
          NOVO: [...prev.NOVO], CONTATADO: [...prev.CONTATADO],
          QUALIFICADO: [...prev.QUALIFICADO], CONVERTIDO: [...prev.CONVERTIDO], DESCARTADO: [...prev.DESCARTADO],
        };
        for (const col of Object.keys(updated) as LeadStatus[]) {
          const idx = updated[col].findIndex((l) => l.id === id);
          if (idx !== -1) {
            const [lead] = updated[col].splice(idx, 1);
            updated[status] = [{ ...lead, status }, ...updated[status]];
            break;
          }
        }
        queryClient.setQueryData(['leads', 'kanban', organization?.id], updated);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['leads', 'kanban', organization?.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ action, status }: { action: 'status' | 'delete'; status?: LeadStatus }) => {
      const token = await getToken();
      return bulkAction(token!, Array.from(selectedIds), action, status);
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const targetStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.key === targetStatus)) return;
    statusMutation.mutate({ id: active.id as string, status: targetStatus });
  }

  function toggleSelect(id: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando leads...</div>;
  }

  const allLeads = data ? Object.values(data).flat() : [];
  const activeLead = activeDragId ? allLeads.find((l) => l.id === activeDragId) ?? null : null;

  return (
    <>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mx-4 mb-3 bg-blue-600 text-white rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold">{selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2 flex-wrap">
            {(['NOVO', 'CONTATADO', 'QUALIFICADO', 'CONVERTIDO'] as LeadStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => bulkMutation.mutate({ action: 'status', status: s })}
                disabled={bulkMutation.isPending}
                className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
            <button
              onClick={() => bulkMutation.mutate({ action: 'delete' })}
              disabled={bulkMutation.isPending}
              className="bg-red-500/80 hover:bg-red-500 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ml-1"
            >
              Descartar
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-white/70 hover:text-white text-xs underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveDragId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-3 h-full min-w-[900px]">
          {COLUMNS.map((col) => {
            const leads = data?.[col.key] ?? [];
            return (
              <div key={col.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>{col.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full font-medium">
                    {leads.length}
                  </span>
                </div>
                <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy} id={col.key}>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto min-h-[120px]">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onClick={setSelectedLead}
                        selected={selectedIds.has(lead.id)}
                        onSelect={selectionMode ? toggleSelect : undefined}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCard lead={activeLead} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <LeadSlideOver
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </>
  );
}
