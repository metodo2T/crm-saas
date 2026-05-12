'use client';
import { OrganizationProfile } from '@clerk/nextjs';

export default function MembersSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold">Membros</h1>
      <OrganizationProfile routing="hash" />
    </div>
  );
}
