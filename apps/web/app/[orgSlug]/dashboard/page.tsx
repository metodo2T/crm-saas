import { auth } from '@clerk/nextjs/server';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

export default async function DashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  await auth.protect();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <OrganizationSwitcher hidePersonal />
          <span className="text-sm text-muted-foreground">CRM</span>
        </div>
        <UserButton />
      </header>
      <main className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Módulos de Leads, WhatsApp e Pipeline em breve.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { title: 'Leads', value: '—', desc: 'Módulo Lead Engine (próximo)' },
            { title: 'Conversas WhatsApp', value: '—', desc: 'Módulo WhatsApp Inbox (próximo)' },
            { title: 'Deals no pipeline', value: '—', desc: 'Módulo Sales Pipeline (próximo)' },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="mt-1 text-3xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
