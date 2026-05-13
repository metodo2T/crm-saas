'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

const NAV = [
  { label: 'Dashboard', seg: 'dashboard' },
  { label: 'Leads', seg: 'leads' },
  { label: 'WhatsApp', seg: 'whatsapp' },
  { label: 'Configurações', seg: 'settings' },
];

export function AppNav() {
  const pathname = usePathname();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const base = `/${orgSlug}`;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 h-14 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold leading-none">C</span>
            </div>
          </div>
          <div className="h-5 w-px bg-slate-200" />
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                organizationSwitcherTrigger:
                  'py-1 px-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md',
              },
            }}
          />
        </div>

        <nav className="flex items-center gap-0.5">
          {NAV.map(({ label, seg }) => {
            const href = seg === 'settings' ? `${base}/settings/workspace` : `${base}/${seg}`;
            const active = pathname.startsWith(`${base}/${seg}`);
            return (
              <Link
                key={seg}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <UserButton />
      </div>
    </header>
  );
}
