'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getKanban } from '@/lib/api/pipeline';
import { PipelineHeader } from './_components/pipeline-header';
import { PipelineKanban } from './_components/pipeline-kanban';
import { NewDealSheet } from './_components/new-deal-sheet';

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
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <PipelineHeader onNewDeal={() => setNewDealOpen(true)} />
      <main className="flex-1 overflow-hidden p-4 bg-slate-50">
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
