'use client';
import { useState } from 'react';
import { useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function OnboardingWorkspacePage() {
  const { createOrganization, setActive } = useOrganizationList();
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !createOrganization) return;
    setLoading(true);
    try {
      const org = await createOrganization({ name });
      await setActive!({ organization: org.id });
      router.push('/onboarding/plan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crie seu workspace</CardTitle>
          <CardDescription>O nome da sua agência. Pode alterar depois.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da agência</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Agência Crescimento Digital"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
              {loading ? 'Criando...' : 'Criar workspace →'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
