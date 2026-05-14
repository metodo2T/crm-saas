'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeal, type KanbanStage } from '@/lib/api/pipeline';
import { searchLeads } from '@/lib/api/leads';

interface Props {
  open: boolean;
  onClose: () => void;
  stages: KanbanStage[];
  defaultStageId?: string;
}

export function NewDealSheet({ open, onClose, stages, defaultStageId }: Props) {
  const regularStages = stages.filter((s) => s.type === 'REGULAR');
  const [title, setTitle] = useState('');
  const [stageId, setStageId] = useState('');
  const [value, setValue] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadId, setLeadId] = useState('');
  const [leadResults, setLeadResults] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setStageId(defaultStageId ?? regularStages[0]?.id ?? '');
    }
  }, [open, defaultStageId]);

  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    let active = true;
    getToken().then((token) => {
      if (!token) return;
      searchLeads(token, leadSearch, 5).then((res) => {
        if (active) setLeadResults(res.items.map((l: any) => ({ id: l.id, name: l.name })));
      }).catch(() => {});
    });
    return () => { active = false; };
  }, [leadSearch]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Título é obrigatório');
      if (!stageId) throw new Error('Selecione um estágio');
      const token = await getToken();
      return createDeal(token!, {
        title: title.trim(),
        stageId,
        leadId: leadId || undefined,
        value: value ? parseFloat(value) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      handleClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleClose() {
    setTitle(''); setStageId(''); setValue('');
    setLeadSearch(''); setLeadId(''); setLeadResults([]);
    setError(''); mutation.reset(); onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-[400px] bg-slate-900 border-slate-700 text-slate-100">
        <SheetHeader>
          <SheetTitle className="text-slate-100">Novo Deal</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4 px-1">
          <div>
            <Label className="text-slate-400 text-xs">Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="Nome do negócio"
            />
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Estágio *</Label>
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
            >
              {regularStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label className="text-slate-400 text-xs">Valor (R$)</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
              placeholder="0,00"
            />
          </div>

          <div className="relative">
            <Label className="text-slate-400 text-xs">Lead vinculado</Label>
            {leadId ? (
              <div className="mt-1 flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-md px-3 py-2">
                <span className="text-sm text-slate-100 flex-1">
                  {leadResults.find((l) => l.id === leadId)?.name ?? leadSearch}
                </span>
                <button onClick={() => { setLeadId(''); setLeadSearch(''); }} className="text-slate-400 hover:text-slate-200 text-xs">✕</button>
              </div>
            ) : (
              <>
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                  placeholder="Buscar lead..."
                />
                {leadResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-600 rounded-md shadow-lg">
                    {leadResults.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => { setLeadId(l.id); setLeadSearch(l.name); setLeadResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {mutation.isPending ? 'Criando...' : 'Criar Deal'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
