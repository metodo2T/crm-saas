'use client';
import { useState } from 'react';
import { useApiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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
      <h1 className="mb-6 text-xl font-bold">Billing</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar assinatura</CardTitle>
          <CardDescription>Altere seu plano, atualize o cartão ou cancele pelo portal Stripe.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={openPortal} disabled={loading}>
            {loading ? 'Abrindo...' : 'Abrir portal de cobrança'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
