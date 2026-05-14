'use client';
import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban, moveDeal, PipelineKanban, Deal } from '@/lib/api/pipeline';
import { StageColumn } from './stage-column';
import { DealCard } from './deal-card';
import { DealSlideOver } from './deal-slide-over';

export function PipelineKanban() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
    refetchInterval: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      const token = await getToken();
      return moveDeal(token!, dealId, stageId);
    },
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      const prev = queryClient.getQueryData<PipelineKanban>(['pipeline', 'kanban', organization?.id]);
      if (prev) {
        const updated: PipelineKanban = {
          ...prev,
          stages: prev.stages.map((s) => ({
            ...s,
            deals: s.deals.filter((d) => d.id !== dealId),
          })),
        };
        let movedDeal: Deal | undefined;
        for (const s of prev.stages) {
          const d = s.deals.find((d) => d.id === dealId);
          if (d) { movedDeal = d; break; }
        }
        if (movedDeal) {
          updated.stages = updated.stages.map((s) =>
            s.id === stageId ? { ...s, deals: [{ ...movedDeal!, stageId }, ...s.deals] } : s
          );
        }
        queryClient.setQueryData(['pipeline', 'kanban', organization?.id], updated);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['pipeline', 'kanban', organization?.id], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
  });

  function findDealInKanban(dealId: string): Deal | undefined {
    for (const stage of data?.stages ?? []) {
      const d = stage.deals.find((d) => d.id === dealId);
      if (d) return d;
    }
  }

  function handleDragStart(event: { active: { id: string | number } }) {
    const deal = findDealInKanban(String(event.active.id));
    if (deal) setActiveDeal(deal);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const dealId = String(active.id);
    const targetStageId = String(over.id);
    const deal = findDealInKanban(dealId);
    if (!deal) return;
    if (deal.stageId === targetStageId) return;
    moveMutation.mutate({ dealId, stageId: targetStageId });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Carregando pipeline...
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 h-full overflow-x-auto pb-4">
          {data.stages.map((stage) => (
            <StageColumn key={stage.id} stage={stage} onDealClick={setSelectedDeal} />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      <DealSlideOver
        deal={selectedDeal}
        open={!!selectedDeal}
        stages={data.stages}
        onClose={() => setSelectedDeal(null)}
      />
    </>
  );
}
