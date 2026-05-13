'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LeadsKanban } from './_components/leads-kanban';
import { NewLeadSheet } from './_components/new-lead-sheet';
import { ImportCsvDialog } from './_components/import-csv-dialog';

export default function LeadsPage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-base font-semibold text-slate-900">Leads</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setImportOpen(true)}>
            ↑ Importar CSV
          </Button>
          <Button
            size="sm"
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setNewLeadOpen(true)}
          >
            + Novo Lead
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 bg-slate-50">
        <LeadsKanban />
      </main>

      <NewLeadSheet open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
