// apps/web/app/[orgSlug]/pipeline/_components/pipeline-header.tsx
'use client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Props {
  onNewDeal: () => void;
}

export function PipelineHeader({ onNewDeal }: Props) {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-[#334155] bg-[#1e293b] shrink-0">
      <h1 className="text-base font-semibold text-slate-100">Pipeline</h1>
      <div className="flex items-center gap-2">
        <Link
          href={`/${orgSlug}/pipeline/settings`}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-md border border-[#334155] hover:border-[#475569] transition-colors"
        >
          Gerenciar estágios
        </Link>
        <Button
          size="sm"
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={onNewDeal}
        >
          + Novo Deal
        </Button>
      </div>
    </div>
  );
}
