'use client';
import { useState } from 'react';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { LeadsKanban } from './_components/leads-kanban';
import { NewLeadSheet } from './_components/new-lead-sheet';
import { ImportCsvDialog } from './_components/import-csv-dialog';

export default function LeadsPage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal />
          <span className="text-sm text-muted-foreground">CRM</span>
        </div>
        <UserButton />
      </header>

      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <h1 className="text-lg font-bold">Leads</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={() => setImportOpen(true)}
          >
            ↑ CSV
          </Button>
          <Button
            size="sm"
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white"
            onClick={() => setNewLeadOpen(true)}
          >
            + Novo Lead
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4">
        <LeadsKanban />
      </main>

      <NewLeadSheet open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
