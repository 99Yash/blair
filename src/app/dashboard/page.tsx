import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PostForm } from '~/components/forms/post-form';
import { auth } from '~/lib/auth/server';

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/signin');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <PostForm />
      </div>
    </div>
  );
}
