// apps/web/app/[orgSlug]/pipeline/_components/deal-card.tsx
'use client';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { type Deal } from '@/lib/api/pipeline';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface Props {
  deal: Deal;
  onClick: (deal: Deal) => void;
}

export function DealCard({ deal, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(deal)}
      className="bg-[#1e293b] border border-[#334155] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all select-none"
    >
      <p className="text-sm font-medium text-slate-200 leading-snug">{deal.title}</p>
      {deal.lead && (
        <p className="text-xs text-slate-500 mt-1">{deal.lead.name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.value != null ? (
          <span className="text-xs font-semibold text-indigo-400">{formatBRL(deal.value)}</span>
        ) : (
          <span />
        )}
        {deal.assignedTo && (
          <span
            className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
            title={deal.assignedTo.name}
          >
            {deal.assignedTo.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {deal.probability != null && (
        <div className="mt-2 h-1 bg-[#334155] rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${deal.probability}%` }}
          />
        </div>
      )}
    </div>
  );
}
