'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Deal, type KanbanStage, updateDeal, moveDeal, deleteDeal } from '@/lib/api/pipeline';
import { useCustomFields } from '@/hooks/use-custom-fields';

interface Props {
  deal: Deal | null;
  open: boolean;
  stages: KanbanStage[];
  onClose: () => void;
}

function formatDateInput(iso?: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function DealSlideOver({ deal, open, stages, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [expectedCloseAt, setExpectedCloseAt] = useState('');
  const [notes, setNotes] = useState('');
  const [targetStageId, setTargetStageId] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'detalhes' | 'campos'>('detalhes');
  const { fields: customFields } = useCustomFields('DEAL');
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const targetStage = stages.find((s) => s.id === targetStageId);

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value != null ? String(deal.value) : '');
      setProbability(deal.probability != null ? String(deal.probability) : '');
      setExpectedCloseAt(formatDateInput(deal.expectedCloseAt));
      setNotes(deal.notes ?? '');
      setTargetStageId(deal.stageId);
      setLostReason(deal.lostReason ?? '');
      setError('');
      setCustomValues((deal.customData as Record<string, unknown>) ?? {});
      setActiveTab('detalhes');
    }
  }, [deal]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return updateDeal(token!, deal!.id, {
        title: title.trim() || undefined,
        value: value ? parseFloat(value) : null,
        probability: probability ? parseInt(probability, 10) : null,
        expectedCloseAt: expectedCloseAt || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return moveDeal(token!, deal!.id, targetStageId, lostReason || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return deleteDeal(token!, deal!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'kanban', organization?.id] });
      onClose();
    },
  });

  const saveCustomMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return updateDeal(token!, deal!.id, { customData: customValues });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  const stageChanged = deal && targetStageId !== deal.stageId;

  if (!deal) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] bg-slate-900 border-slate-700 text-slate-100 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-slate-100 truncate">{deal.title}</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 mt-4 px-1">
          {(['detalhes', 'campos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 mr-4 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-indigo-300 border-indigo-500'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab === 'detalhes' ? 'Detalhes' : 'Campos extras'}
            </button>
          ))}
        </div>

        {activeTab === 'detalhes' && (
          <div className="mt-6 space-y-4 px-1">
            <div>
              <Label className="text-slate-400 text-xs">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400 text-xs">Valor (R$)</Label>
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <Label className="text-slate-400 text-xs">Probabilidade (%)</Label>
                <Input
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                  type="number"
                  min="0"
                  max="100"
                  className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-400 text-xs">Data de fechamento prevista</Label>
              <Input
                value={expectedCloseAt}
                onChange={(e) => setExpectedCloseAt(e.target.value)}
                type="date"
                className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>

            <div>
              <Label className="text-slate-400 text-xs">Notas</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
            </Button>

            <div className="border-t border-slate-700 pt-4">
              <Label className="text-slate-400 text-xs">Mover para estágio</Label>
              <select
                value={targetStageId}
                onChange={(e) => setTargetStageId(e.target.value)}
                className="mt-1 w-full rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {targetStage?.type === 'LOST' && (
                <div className="mt-2">
                  <Label className="text-slate-400 text-xs">Motivo da perda</Label>
                  <Input
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="mt-1 bg-slate-800 border-slate-600 text-slate-100"
                    placeholder="Ex: Preço, Concorrente..."
                  />
                </div>
              )}

              {stageChanged && (
                <Button
                  onClick={() => moveMutation.mutate()}
                  disabled={moveMutation.isPending}
                  className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-white"
                >
                  {moveMutation.isPending ? 'Movendo...' : `Mover para "${targetStage?.name}"`}
                </Button>
              )}
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="border-t border-slate-700 pt-4">
              {deal.lead && (
                <p className="text-xs text-slate-500 mb-2">Lead: {deal.lead.name}</p>
              )}
              {deal.wonAt && <p className="text-xs text-green-400 mb-2">Ganho em {new Date(deal.wonAt).toLocaleDateString('pt-BR')}</p>}
              {deal.lostAt && <p className="text-xs text-red-400 mb-2">Perdido em {new Date(deal.lostAt).toLocaleDateString('pt-BR')}{deal.lostReason ? ` — ${deal.lostReason}` : ''}</p>}
              <Button
                variant="outline"
                onClick={() => { if (confirm('Excluir este deal?')) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="w-full border-red-800 text-red-400 hover:bg-red-950"
              >
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir deal'}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'campos' && (
          <div className="mt-6 px-1">
            {customFields.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Nenhum campo customizado definido.{' '}
                <span className="text-indigo-400">Configure em Configurações → Campos Deals.</span>
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {customFields.map((field) => {
                    const value = customValues[field.slug] ?? (deal.customData as Record<string, unknown>)?.[field.slug] ?? '';
                    return (
                      <div key={field.id}>
                        <Label className="text-slate-400 text-xs">{field.name}</Label>
                        {field.type === 'CHECKBOX' ? (
                          <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.checked }))}
                            className="mt-1 w-4 h-4 accent-indigo-500"
                          />
                        ) : field.type === 'SELECT' ? (
                          <select
                            value={String(value)}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                            className="mt-1 w-full h-8 px-3 rounded-md bg-slate-800 border border-slate-600 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">— Selecionar —</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'MULTI_SELECT' ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(field.options ?? []).map((opt) => {
                              const selected = Array.isArray(value) ? (value as string[]).includes(opt) : false;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    const current = Array.isArray(value) ? (value as string[]) : [];
                                    const next = selected ? current.filter((v) => v !== opt) : [...current, opt];
                                    setCustomValues((prev) => ({ ...prev, [field.slug]: next }));
                                  }}
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    selected
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            type={
                              field.type === 'NUMBER' ? 'number'
                              : field.type === 'DATE' ? 'date'
                              : field.type === 'URL' ? 'url'
                              : 'text'
                            }
                            value={String(value)}
                            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.slug]: e.target.value }))}
                            placeholder="—"
                            className="mt-1 bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <Button
                  onClick={() => saveCustomMutation.mutate()}
                  disabled={saveCustomMutation.isPending}
                  className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saveCustomMutation.isPending ? 'Salvando...' : 'Salvar campos'}
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
