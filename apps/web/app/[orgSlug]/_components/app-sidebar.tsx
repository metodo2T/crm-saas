'use client';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard, Users, Kanban, MessageCircle, Settings,
} from 'lucide-react';

const NAV = [
  { label: 'Dashboard',     seg: 'dashboard', Icon: LayoutDashboard },
  { label: 'Leads',         seg: 'leads',     Icon: Users },
  { label: 'Pipeline',      seg: 'pipeline',  Icon: Kanban },
  { label: 'WhatsApp',      seg: 'whatsapp',  Icon: MessageCircle },
  { label: 'Configurações', seg: 'settings',  Icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const base = `/${orgSlug}`;

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-[#1e293b] border-r border-[#334155]">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold leading-none">C</span>
        </div>
        <span className="text-slate-100 text-sm font-bold tracking-tight">CRM</span>
      </div>

      {/* Org switcher */}
      <div className="px-3 mb-4">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              organizationSwitcherTrigger:
                'w-full justify-start py-1.5 px-2 text-xs text-slate-300 hover:bg-[#334155] rounded-md transition-colors',
            },
          }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV.map(({ label, seg, Icon }) => {
          const href = seg === 'settings' ? `${base}/settings/workspace` : `${base}/${seg}`;
          const active = pathname.startsWith(`${base}/${seg}`);
          return (
            <Link
              key={seg}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-500/15 text-indigo-300 border-l-2 border-indigo-500'
                  : 'text-slate-400 hover:bg-[#334155]/60 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[#334155]">
        <UserButton
          appearance={{
            elements: {
              userButtonBox: 'flex items-center gap-2',
              userButtonOuterIdentifier: 'text-xs text-slate-400',
            },
          }}
          showName
        />
      </div>
    </aside>
  );
}
