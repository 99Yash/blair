import { headers } from 'next/headers';
import { Landing } from '~/components/sections/landing';
import { auth } from '~/lib/auth/server';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div>
      {session ? (
        <div className="flex flex-col items-center justify-center h-full bg-green-100">
          <h1>Dashboard</h1>
        </div>
      ) : (
        <Landing />
      )}
    </div>
  );
}
