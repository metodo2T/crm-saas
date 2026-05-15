'use client';
import { OrganizationProfile } from '@clerk/nextjs';

export default function MembersSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-slate-100">Membros</h1>
      <OrganizationProfile
        routing="hash"
        appearance={{
          elements: {
            card: 'bg-[#1e293b] border-[#334155] shadow-none',
            navbar: 'bg-[#1e293b]',
            navbarButton: 'text-slate-400',
            navbarButtonActive: 'text-indigo-400',
          },
        }}
      />
    </div>
  );
}
