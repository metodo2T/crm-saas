'use client';
import { useDroppable } from '@dnd-kit/core';
import { type KanbanStage, type Deal } from '@/lib/api/pipeline';
import { DealCard } from './deal-card';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface Props {
  stage: KanbanStage;
  onDealClick: (deal: Deal) => void;
}

export function StageColumn({ stage, onDealClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
        <span className="text-sm font-semibold text-slate-700 truncate">{stage.name}</span>
        <span className="ml-auto text-xs text-slate-400 shrink-0">{stage.deals.length}</span>
      </div>
      {stage.totalValue > 0 && (
        <p className="text-xs text-slate-400 px-1 mb-2">{formatBRL(stage.totalValue)}</p>
      )}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 min-h-[200px] rounded-lg p-2 transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-blue-200 border-dashed' : 'bg-slate-100'
        }`}
      >
        {stage.deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={onDealClick} />
        ))}
      </div>
    </div>
  );
}
