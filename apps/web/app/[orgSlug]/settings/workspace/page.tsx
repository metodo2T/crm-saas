'use client';
import { useEffect, useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function WorkspaceSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (organization?.name) setName(organization.name);
  }, [organization?.name]);

  if (!isLoaded || !organization) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await organization!.update({ name });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Configurações do Workspace</h1>
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Informações gerais</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-slate-400 text-xs">Nome da agência</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600 focus:ring-indigo-500"
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </form>
      </div>
    </div>
  );
}
