'use client';
import { useState } from 'react';
import { useApiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

export default function BillingSettingsPage() {
  const api = useApiClient();
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const { url } = await api.post<{ url: string }>('/billing/portal', {
        returnUrl: window.location.href,
      });
      if (url) window.location.href = url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Billing</h1>
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-1">Gerenciar assinatura</h2>
        <p className="text-xs text-slate-500 mb-4">Altere seu plano, atualize o cartão ou cancele pelo portal Stripe.</p>
        <Button onClick={openPortal} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {loading ? 'Abrindo...' : 'Abrir portal de cobrança'}
        </Button>
      </div>
    </div>
  );
}
