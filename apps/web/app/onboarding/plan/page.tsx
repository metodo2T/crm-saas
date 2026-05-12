'use client';
import { useState } from 'react';
import { useApiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PLANS = [
  { name: 'Starter', priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER ?? '', price: 'R$ 197/mês', features: ['3 usuários', '500 leads/mês', '1 número WhatsApp'], badge: null },
  { name: 'Pro', priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '', price: 'R$ 397/mês', features: ['10 usuários', '2.000 leads/mês', '3 números WhatsApp', 'Relatórios avançados'], badge: 'Mais popular' },
  { name: 'Agency', priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY ?? '', price: 'R$ 797/mês', features: ['Usuários ilimitados', 'Leads ilimitados', 'WhatsApp ilimitado', 'White-label + API'], badge: null },
];

export default function OnboardingPlanPage() {
  const api = useApiClient();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelectPlan(priceId: string, planName: string) {
    setLoading(planName);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout', {
        priceId,
        successUrl: `${window.location.origin}/onboarding/checklist`,
        cancelUrl: `${window.location.origin}/onboarding/plan`,
      });
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-3xl">
        <h1 className="mb-2 text-center text-2xl font-bold">Escolha seu plano</h1>
        <p className="mb-8 text-center text-muted-foreground">Sem fidelidade. Cancele quando quiser.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.name} className="relative">
              {plan.badge && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">{plan.badge}</Badge>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription className="text-lg font-semibold text-foreground">{plan.price}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.priceId, plan.name)}
                  disabled={loading === plan.name}
                >
                  {loading === plan.name ? 'Redirecionando...' : 'Escolher plano'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
