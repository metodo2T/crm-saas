import { auth } from '@clerk/nextjs/server';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default async function DashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  await auth.protect();
  const { orgSlug } = await params;

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
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Link
            href={`/${orgSlug}/leads`}
            className="rounded-xl border bg-card p-5 hover:bg-accent transition-colors"
          >
            <p className="text-sm text-muted-foreground">Leads</p>
            <p className="mt-1 text-3xl font-bold">—</p>
            <p className="mt-1 text-xs text-blue-400">Abrir Lead Engine →</p>
          </Link>
          {[
            { title: 'Conversas WhatsApp', desc: 'Módulo WhatsApp Inbox (próximo)' },
            { title: 'Deals no pipeline', desc: 'Módulo Sales Pipeline (próximo)' },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="mt-1 text-3xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
