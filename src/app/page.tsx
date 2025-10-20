import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Landing } from '~/components/sections/landing';
import { auth } from '~/lib/auth/server';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    redirect('/create');
  }

  return <Landing />;
}
