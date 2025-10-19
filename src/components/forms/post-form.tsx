'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, FileText, Loader2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';

import * as React from 'react';
import { GENERATED_POST_CONTENT_MAX_LENGTH } from '~/lib/constants';
import { postFormSchema, type PostFormData } from '~/lib/schemas/post';

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

const OWNERSHIP_TYPES = [
  { value: 'own_content', label: 'Own Content' },
  { value: 'third_party_content', label: 'Third Party Content' },
] as const;

export function PostForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const form = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      post_content: '',
      platform: 'twitter' as const,
      original_url: '',
      link_ownership_type: 'own_content',
      tone_profile: [
        { tone: 'professional' as const, weight: 50 },
        { tone: 'inspirational' as const, weight: 50 },
      ],
    },
  });

  const onSubmit = async (data: PostFormData) => {
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/posts/train', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save post');
      }

      toast.success('Post data saved successfully!');
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save post data'
      );
      console.error('Error saving post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const postContentLength = form.watch('post_content').length;

  const handleScrapeAndAnalyze = async () => {
    const url = form.getValues('original_url');

    if (!url) {
      toast.error('Please enter a URL first');
      return;
    }

    try {
      const formData = form.getValues();
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scrape URL');
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to scrape and analyze URL'
      );
      console.error('Scraping error:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Post</h1>
        <p className="text-muted-foreground">
          Fill in the details below to create a post. The AI will infer
          embeddings and other metadata.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-xl">Basic Information</CardTitle>
              <CardDescription>Core details for your post.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Controller
                name="post_content"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Post Content</FieldLabel>
                    <Textarea
                      placeholder="Write your post caption here..."
                      className="min-h-[100px]"
                      {...field}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <FieldDescription>
                        The main caption or content for your social media post
                      </FieldDescription>
                      <span>
                        {postContentLength}/{GENERATED_POST_CONTENT_MAX_LENGTH}
                      </span>{' '}
                      {/* Character counter */}
                    </div>
                    <FieldError
                      errors={
                        form.formState.errors.post_content?.message
                          ? [
                              {
                                message:
                                  form.formState.errors.post_content.message,
                              },
                            ]
                          : undefined
                      }
                    />
                  </Field>
                )}
              />

              <Controller
                name="original_url"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel className="flex items-center justify-between">
                      Original URL
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleScrapeAndAnalyze}
                        disabled={!field.value}
                        className="ml-2"
                      >
                        {form.formState.isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Bot className="h-4 w-4 mr-2" />
                            Analyze Content
                          </>
                        )}
                      </Button>
                    </FieldLabel>
                    <Input
                      placeholder="https://example.com/article"
                      type="url"
                      {...field}
                    />
                    <FieldDescription>
                      The URL this post is linking to. Click &ldquo;Analyze
                      Content&rdquo; to automatically fill form fields.
                    </FieldDescription>
                    <FieldError
                      errors={
                        form.formState.errors.original_url?.message
                          ? [
                              {
                                message:
                                  form.formState.errors.original_url.message,
                              },
                            ]
                          : undefined
                      }
                    />
                  </Field>
                )}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Controller
                name="platform"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Platform</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((platform) => (
                          <SelectItem
                            key={platform.value}
                            value={platform.value}
                          >
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      errors={
                        form.formState.errors.platform?.message
                          ? [
                              {
                                message: form.formState.errors.platform.message,
                              },
                            ]
                          : undefined
                      }
                    />
                  </Field>
                )}
              />

              <Controller
                name="link_ownership_type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Link Ownership</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ownership type" />
                      </SelectTrigger>
                      <SelectContent>
                        {OWNERSHIP_TYPES.map((ownership) => (
                          <SelectItem
                            key={ownership.value}
                            value={ownership.value}
                          >
                            {ownership.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      errors={
                        form.formState.errors.link_ownership_type?.message
                          ? [
                              {
                                message:
                                  form.formState.errors.link_ownership_type
                                    .message,
                              },
                            ]
                          : undefined
                      }
                    />
                  </Field>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Post Data'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
