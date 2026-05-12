import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgId } = await auth();
  if (!orgId) redirect('/onboarding/workspace');
  return <>{children}</>;
}
