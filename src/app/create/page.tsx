'use client';

import { GeneratePostForm } from '~/components/forms/generate-post-form';

export default function CreatePage() {
  return (
    <div className="container max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Create Social Media Post</h1>
        <p className="text-muted-foreground text-sm">
          Generate engaging social media content from any URL using AI
        </p>
      </div>

      <GeneratePostForm />
    </div>
  );
}
