import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AppSidebar } from './_components/app-sidebar';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgId, orgSlug: authOrgSlug } = await auth();
  if (!orgId) redirect('/onboarding/workspace');

  const { orgSlug } = await params;
  if (authOrgSlug && authOrgSlug !== orgSlug) redirect(`/${authOrgSlug}/dashboard`);

  return (
    <div className="flex h-screen bg-[#0f172a]">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
