'use client';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const STEPS = [
  { label: 'Conectar WhatsApp', description: 'Vincule seu número para receber e enviar mensagens', href: '/whatsapp' },
  { label: 'Convidar time', description: 'Adicione membros ao seu workspace', href: '/settings/members' },
  { label: 'Adicionar primeiro lead', description: 'Importe ou cadastre manualmente', href: '/leads' },
];

export default function OnboardingChecklistPage() {
  const router = useRouter();
  const { organization, isLoaded } = useOrganization();

  function goTo(href: string) {
    if (!organization?.slug) return;
    router.push(`/${organization.slug}${href}`);
  }

  function goToDashboard() {
    if (!organization?.slug) return;
    router.push(`/${organization.slug}/dashboard`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Tudo pronto!</CardTitle>
          <CardDescription>Complete as etapas abaixo ou pule para o dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.label} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!isLoaded || !organization}
                onClick={() => goTo(step.href)}
              >
                Configurar
              </Button>
            </div>
          ))}
          <Button className="mt-4 w-full" onClick={goToDashboard} disabled={!isLoaded || !organization}>
            Ir para o dashboard →
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
