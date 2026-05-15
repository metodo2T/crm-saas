'use client';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CustomFieldDef, CustomFieldEntity, CustomFieldType,
  createCustomField, updateCustomField, deleteCustomField,
} from '@/lib/api/custom-fields';
import { useCustomFields } from '@/hooks/use-custom-fields';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto', NUMBER: 'Número', DATE: 'Data',
  SELECT: 'Seleção', MULTI_SELECT: 'Multi-seleção',
  CHECKBOX: 'Checkbox', URL: 'URL',
};

const TYPE_COLORS: Record<CustomFieldType, string> = {
  TEXT: 'bg-blue-950 text-blue-300',
  NUMBER: 'bg-indigo-950 text-indigo-300',
  DATE: 'bg-violet-950 text-violet-300',
  SELECT: 'bg-amber-950 text-amber-300',
  MULTI_SELECT: 'bg-orange-950 text-orange-300',
  CHECKBOX: 'bg-emerald-950 text-emerald-300',
  URL: 'bg-cyan-950 text-cyan-300',
};

interface Props {
  entity: CustomFieldEntity;
}

export function CustomFieldsManager({ entity }: Props) {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const { fields, isLoading } = useCustomFields(entity);

  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXT');
  const [optionsInput, setOptionsInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['custom-fields', organization?.id, entity] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const options =
        (type === 'SELECT' || type === 'MULTI_SELECT') && optionsInput.trim()
          ? optionsInput.split(',').map((o) => o.trim()).filter(Boolean)
          : undefined;
      return createCustomField(token!, entity, name.trim(), type, options);
    },
    onSuccess: () => { invalidate(); setName(''); setOptionsInput(''); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const token = await getToken();
      return updateCustomField(token!, id, { name });
    },
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      return deleteCustomField(token!, id);
    },
    onSuccess: invalidate,
  });

  const needsOptions = type === 'SELECT' || type === 'MULTI_SELECT';

  return (
    <div className="max-w-xl">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl overflow-hidden mb-3">
        <div className="flex items-center px-4 py-2 border-b border-[#334155]">
          <span className="flex-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nome</span>
          <span className="w-28 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tipo</span>
          <span className="w-16" />
        </div>

        {isLoading && (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">Carregando...</p>
        )}

        {!isLoading && fields.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Nenhum campo definido. Adicione o primeiro abaixo.
          </p>
        )}

        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center px-4 py-3 border-b border-[#334155]/50 last:border-0"
          >
            <div className="flex-1 pr-2">
              {editingId === field.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs bg-[#0f172a] border-[#334155] text-slate-100"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => updateMutation.mutate({ id: field.id, name: editName })}
                    disabled={updateMutation.isPending}
                  >
                    OK
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-[#334155]"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <span
                  className="text-sm font-medium text-slate-200 cursor-pointer hover:text-indigo-300"
                  onClick={() => { setEditingId(field.id); setEditName(field.name); }}
                >
                  {field.name}
                </span>
              )}
            </div>
            <span className="w-28">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${TYPE_COLORS[field.type]}`}>
                {TYPE_LABELS[field.type]}
              </span>
            </span>
            <button
              onClick={() => { if (confirm(`Remover campo "${field.name}"?`)) deleteMutation.mutate(field.id); }}
              disabled={deleteMutation.isPending}
              className="w-16 text-right text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate(); }}
        className="bg-[#1e293b] border border-dashed border-indigo-500/40 rounded-xl p-4 space-y-3"
      >
        <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Novo campo</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do campo..."
            className="flex-1 h-8 text-sm bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="h-8 rounded-md border border-[#334155] bg-[#0f172a] text-slate-100 text-sm px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        {needsOptions && (
          <Input
            value={optionsInput}
            onChange={(e) => setOptionsInput(e.target.value)}
            placeholder="Opções separadas por vírgula: B2B, B2C, Outro"
            className="h-8 text-sm bg-[#0f172a] border-[#334155] text-slate-100 placeholder:text-slate-600"
          />
        )}
        <Button
          type="submit"
          disabled={!name.trim() || createMutation.isPending}
          className="h-8 w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
        >
          {createMutation.isPending ? 'Salvando...' : '+ Adicionar campo'}
        </Button>
      </form>
    </div>
  );
}
