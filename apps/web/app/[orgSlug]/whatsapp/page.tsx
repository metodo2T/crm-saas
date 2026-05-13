'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { getWaInstance, WaInstance } from '@/lib/api/whatsapp';
import { WaSetup } from './_components/wa-setup';
import { WaInbox } from './_components/wa-inbox';

function WhatsAppPageInner() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const [forceSetup, setForceSetup] = useState(false);
  const searchParams = useSearchParams();
  const initialJid = searchParams.get('jid');

  const { data: instance, isLoading } = useQuery<WaInstance | null>({
    queryKey: ['wa', 'instance', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getWaInstance(token!);
    },
    enabled: !!organization?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Carregando...
      </div>
    );
  }

  const isConnected = instance?.status === 'CONNECTED' && !forceSetup;

  if (!isConnected) {
    return (
      <div className="p-6">
        <WaSetup onConnected={() => setForceSetup(false)} />
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)' }} className="flex flex-col">
      <WaInbox instance={instance} onDisconnect={() => setForceSetup(true)} initialJid={initialJid} />
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <Suspense>
      <WhatsAppPageInner />
    </Suspense>
  );
}
