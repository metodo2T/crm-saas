// apps/web/app/[orgSlug]/pipeline/page.tsx
'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban } from '@/lib/api/pipeline';
import { PipelineHeader } from './_components/pipeline-header';
import { NewDealSheet } from './_components/new-deal-sheet';

const PipelineKanban = dynamic(
  () => import('./_components/pipeline-kanban').then((m) => m.PipelineKanban),
  { ssr: false }
);

export default function PipelinePage() {
  const [newDealOpen, setNewDealOpen] = useState(false);
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const { data } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="flex flex-col h-full">
      <PipelineHeader onNewDeal={() => setNewDealOpen(true)} />
      <main className="flex-1 overflow-hidden p-4 bg-[#0f172a]">
        <PipelineKanban />
      </main>
      <NewDealSheet
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        stages={data?.stages ?? []}
      />
    </div>
  );
}
