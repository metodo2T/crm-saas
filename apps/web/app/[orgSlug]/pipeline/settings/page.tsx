'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getKanban, createStage, updateStage, deleteStage, KanbanStage } from '@/lib/api/pipeline';

const PRESET_COLORS = ['#94a3b8','#3b82f6','#a855f7','#f59e0b','#ef4444','#22c55e','#ec4899','#14b8a6'];

export default function PipelineSettingsPage() {
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const { data } = useQuery({
    queryKey: ['pipeline', 'kanban', organization?.id],
    queryFn: async () => {
      const token = await getToken();
      return getKanban(token!);
    },
    enabled: !!organization?.id,
  });

  const stages = data?.stages ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newStageName.trim()) throw new Error('Nome é obrigatório');
      const token = await getToken();
      return createStage(token!, { name: newStageName.trim(), color: newStageColor });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      setNewStageName('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken();
      return updateStage(token!, id, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return deleteStage(token!, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function startEdit(stage: KanbanStage) {
    setEditingId(stage.id);
    setEditName(stage.name);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/${orgSlug}/pipeline`)} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Voltar ao Pipeline
        </button>
        <h1 className="text-lg font-semibold text-slate-900">Gerenciar estágios</h1>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="space-y-2 mb-8">
        {stages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            {editingId === stage.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-7 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="text-xs h-7 bg-blue-600 text-white"
                  onClick={() => updateMutation.mutate({ id: stage.id, name: editName })}
                  disabled={updateMutation.isPending}
                >
                  Salvar
                </Button>
                <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs hover:text-slate-600">Cancelar</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{stage.name}</span>
                {stage.type === 'REGULAR' ? (
                  <>
                    <button onClick={() => startEdit(stage)} className="text-xs text-slate-400 hover:text-slate-600">Renomear</button>
                    <button
                      onClick={() => { if (confirm(`Excluir "${stage.name}"? Os deals serão movidos.`)) deleteMutation.mutate(stage.id); }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Excluir
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(stage)} className="text-xs text-slate-400 hover:text-slate-600">Renomear</button>
                    <span className="text-xs text-slate-300">{stage.type === 'WON' ? 'Terminal (Ganho)' : 'Terminal (Perdido)'}</span>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Adicionar estágio</h2>
        <div className="flex gap-2 flex-wrap mb-3">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setNewStageColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${newStageColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Nome do estágio"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && createMutation.mutate()}
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {createMutation.isPending ? '...' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
