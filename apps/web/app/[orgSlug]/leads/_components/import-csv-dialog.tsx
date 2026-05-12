'use client';
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importCsv } from '@/lib/api/leads';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportCsvDialog({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecione um arquivo CSV');
      const token = await getToken();
      return importCsv(token!, file);
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban', organization?.id] });
    },
  });

  function handleClose() {
    setFile(null);
    setResult(null);
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Importar CSV</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-xs text-slate-400">
            Colunas aceitas:{' '}
            <code className="text-blue-400">nome, email, telefone, empresa, observações</code>
            <br />
            Máximo 500 linhas por importação.
          </p>

          {!result ? (
            <>
              <div
                className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <p className="text-sm text-slate-300">{file.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Clique para selecionar ou arraste o arquivo CSV
                  </p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {mutation.error && (
                <p className="text-red-400 text-xs">{(mutation.error as Error).message}</p>
              )}
              <Button
                onClick={() => mutation.mutate()}
                disabled={!file || mutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              >
                {mutation.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                <p>
                  <span className="text-green-400 font-semibold">{result.imported}</span> leads
                  importados
                </p>
                {result.skipped > 0 && (
                  <p>
                    <span className="text-amber-400">{result.skipped}</span> pulados
                  </p>
                )}
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-400 text-xs mb-1">{result.errors.length} erros:</p>
                    {result.errors.slice(0, 5).map((e) => (
                      <p key={e.row} className="text-xs text-slate-500">
                        Linha {e.row}: {e.reason}
                      </p>
                    ))}
                    {result.errors.length > 5 && (
                      <p className="text-xs text-slate-600">+{result.errors.length - 5} mais</p>
                    )}
                  </div>
                )}
              </div>
              <Button onClick={handleClose} className="w-full" variant="outline">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
