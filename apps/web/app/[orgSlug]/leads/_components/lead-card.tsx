// apps/web/app/[orgSlug]/leads/_components/lead-card.tsx
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
  MANUAL: 'bg-slate-800 text-slate-400',
  CSV:    'bg-slate-800 text-slate-400',
  FORM:   'bg-indigo-950 text-indigo-400',
  WHATSAPP: 'bg-emerald-950 text-emerald-400',
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
      className={`relative bg-[#1e293b] border rounded-lg p-3 cursor-pointer transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
          : 'border-[#334155] hover:border-indigo-500/50 hover:shadow-sm'
      }`}
    >
      {onSelect && (
        <div className="absolute top-2.5 right-2.5">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 bg-[#0f172a]'
          }`}>
            {selected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      )}
      <p className={`text-sm font-semibold text-slate-200 mb-1 ${onSelect ? 'pr-6' : ''}`}>{lead.name}</p>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SOURCE_COLORS[lead.source] ?? 'bg-slate-800 text-slate-400'}`}>
          {lead.source}
        </span>
        <span className="text-[10px] text-slate-600">{relativeTime}</span>
      </div>
      {lead.assignedTo ? (
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] text-white font-bold">
            {lead.assignedTo.name[0].toUpperCase()}
          </div>
          <span className="text-[10px] text-slate-500">{lead.assignedTo.name}</span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-600">sem responsável</span>
      )}
    </div>
  );
}
