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

  if (session.user.email !== 'yashgouravkar@gmail.com') {
    redirect('/create');
  }

  return <PostForm />;
}
