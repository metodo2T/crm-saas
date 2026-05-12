'use client';
import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, updateLeadStatus, Lead, LeadStatus, KanbanData } from '@/lib/api/leads';
import { LeadCard } from './lead-card';
import { LeadSlideOver } from './lead-slide-over';

const COLUMNS: { key: LeadStatus; label: string; color: string; dot: string }[] = [
  { key: 'NOVO', label: 'Novo', color: 'text-blue-400', dot: 'bg-blue-500' },
  { key: 'CONTATADO', label: 'Contatado', color: 'text-amber-400', dot: 'bg-amber-500' },
  { key: 'QUALIFICADO', label: 'Qualificado', color: 'text-violet-400', dot: 'bg-violet-500' },
  { key: 'CONVERTIDO', label: 'Convertido', color: 'text-green-400', dot: 'bg-green-500' },
  { key: 'DESCARTADO', label: 'Descartado', color: 'text-red-400', dot: 'bg-red-500' },
];

export function LeadsKanban() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

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
          NOVO: [...prev.NOVO],
          CONTATADO: [...prev.CONTATADO],
          QUALIFICADO: [...prev.QUALIFICADO],
          CONVERTIDO: [...prev.CONVERTIDO],
          DESCARTADO: [...prev.DESCARTADO],
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const targetStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.key === targetStatus)) return;
    statusMutation.mutate({ id: active.id as string, status: targetStatus });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Carregando leads...
      </div>
    );
  }

  const allLeads = data ? Object.values(data).flat() : [];
  const activeLead = activeDragId ? allLeads.find((l) => l.id === activeDragId) ?? null : null;

  return (
    <>
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
              <div
                key={col.key}
                className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden flex flex-col"
              >
                <div className="px-3 py-2.5 border-b border-[#1e293b] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>
                      {col.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                    {leads.length}
                  </span>
                </div>
                <SortableContext
                  items={leads.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                  id={col.key}
                >
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto min-h-[80px]">
                    {leads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onClick={setSelectedLead} />
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
