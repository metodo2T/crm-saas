'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  lead: Lead;
  onClick: (lead: Lead) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  CSV: 'bg-slate-100 text-slate-600',
  FORM: 'bg-blue-50 text-blue-600',
  WHATSAPP: 'bg-green-50 text-green-700',
};

export function LeadCard({ lead, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const relativeTime = formatDistanceToNow(new Date(lead.createdAt), {
    addSuffix: true, locale: ptBR,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(lead)}
      className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-semibold text-slate-900 mb-1">{lead.name}</p>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SOURCE_COLORS[lead.source]}`}>
          {lead.source}
        </span>
        <span className="text-[10px] text-slate-400">{relativeTime}</span>
      </div>
      {lead.assignedTo ? (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white font-bold">
            {lead.assignedTo.name[0].toUpperCase()}
          </div>
          <span className="text-[10px] text-slate-500">{lead.assignedTo.name}</span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-400">sem responsável</span>
      )}
    </div>
  );
}
