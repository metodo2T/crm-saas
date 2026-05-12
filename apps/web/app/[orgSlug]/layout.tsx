import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgId, orgSlug: authOrgSlug } = await auth();
  if (!orgId) redirect('/onboarding/workspace');

  const { orgSlug } = await params;
  if (authOrgSlug && authOrgSlug !== orgSlug) redirect(`/${authOrgSlug}/dashboard`);

  return <>{children}</>;
}
