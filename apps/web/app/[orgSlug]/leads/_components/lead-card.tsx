'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/lib/api/leads';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  lead: Lead;
  onClick: (lead: Lead) => void;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  CSV: 'bg-slate-100 text-slate-600',
  FORM: 'bg-blue-50 text-blue-600',
  WHATSAPP: 'bg-green-50 text-green-700',
};

export function LeadCard({ lead, onClick, selected = false, onSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled: !!onSelect,
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
      {...(onSelect ? {} : { ...attributes, ...listeners })}
      onClick={() => onSelect ? onSelect(lead.id, !selected) : onClick(lead)}
      className={`relative bg-white border rounded-lg p-3 cursor-pointer transition-all ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
          : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
      }`}
    >
      {onSelect && (
        <div className="absolute top-2.5 right-2.5">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
          }`}>
            {selected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}
      <p className={`text-sm font-semibold text-slate-900 mb-1 ${onSelect ? 'pr-6' : ''}`}>{lead.name}</p>
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
