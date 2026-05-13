import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { userId, orgSlug } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  if (orgSlug) {
    redirect(`/${orgSlug}/dashboard`);
  }

  redirect('/onboarding/workspace');
}
