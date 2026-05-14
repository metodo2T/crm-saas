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
    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
      <h1 className="text-base font-semibold text-slate-900">Pipeline</h1>
      <div className="flex items-center gap-2">
        <Link
          href={`/${orgSlug}/pipeline/settings`}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
        >
          Gerenciar estágios
        </Link>
        <Button
          size="sm"
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onNewDeal}
        >
          + Novo Deal
        </Button>
      </div>
    </div>
  );
}
