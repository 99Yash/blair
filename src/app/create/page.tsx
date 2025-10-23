import { Sparkles } from 'lucide-react';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GeneratePostForm } from '~/components/forms/generate-post-form';
import { UserDropdown } from '~/components/utils/user-dropdown';
import { auth } from '~/lib/auth/server';
import { siteConfig } from '~/lib/site';

export default async function CreatePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/signin');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>

          <div className="flex items-center gap-4">
            {session?.user ? (
              <UserDropdown />
            ) : (
              <Link
                href="/signin"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Create Social Media Post</h1>
          <p className="text-muted-foreground text-sm">
            Generate engaging social media content from any URL using AI
          </p>
        </div>

        <GeneratePostForm />
      </div>
    </div>
  );
}
