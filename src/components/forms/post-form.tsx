'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Bot,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
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
import { Slider } from '~/components/ui/slider';
import { Textarea } from '~/components/ui/textarea';

import { POST_CONTENT_MAX_LENGTH } from '~/lib/constants';
import { postFormSchema, type PostFormData } from '~/lib/schemas/post';

const PLATFORMS = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

const CTA_TYPES = [
  { value: 'learn_more', label: 'Learn More' },
  { value: 'sign_up', label: 'Sign Up' },
  { value: 'buy_now', label: 'Buy Now' },
  { value: 'read_article', label: 'Read Article' },
  { value: 'watch_video', label: 'Watch Video' },
  { value: 'download', label: 'Download' },
  { value: 'join_community', label: 'Join Community' },
  { value: 'poll_question', label: 'Poll Question' },
  { value: 'other', label: 'Other' },
] as const;

const OWNERSHIP_TYPES = [
  { value: 'own_content', label: 'Own Content' },
  { value: 'third_party_content', label: 'Third Party Content' },
] as const;

const AUDIENCES = [
  { value: 'developers', label: 'Developers' },
  { value: 'marketers', label: 'Marketers' },
  { value: 'entrepreneurs', label: 'Entrepreneurs' },
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
  { value: 'general_public', label: 'General Public' },
  { value: 'creatives', label: 'Creatives' },
  { value: 'finance_professionals', label: 'Finance Professionals' },
  { value: 'other', label: 'Other' },
] as const;

const TONES = [
  { value: 'witty', label: 'Witty' },
  { value: 'professional', label: 'Professional' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'casual', label: 'Casual' },
  { value: 'direct', label: 'Direct' },
  { value: 'empathetic', label: 'Empathetic' },
] as const;

const CONTENT_TYPES = [
  { value: 'self_help', label: 'Self Help' },
  { value: 'tech_tutorial', label: 'Tech Tutorial' },
  { value: 'news_article', label: 'News Article' },
  { value: 'product_review', label: 'Product Review' },
  { value: 'thought_leadership', label: 'Thought Leadership' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
] as const;

export function PostForm() {
  const form = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      post_content: '',
      platform: 'twitter' as const,
      content_type: 'other' as const,
      original_url: '',
      call_to_action_type: 'learn_more' as const,
      sales_pitch_strength: 100,
      tone_profile: [
        { tone: 'professional' as const, weight: 50 },
        { tone: 'inspirational' as const, weight: 50 },
      ], // Start with two for better UX
      link_ownership_type: 'own_content' as const,
      target_audience: 'general_public' as const,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tone_profile',
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (data: PostFormData) => {
    try {
      const response = await fetch('/api/posts', {
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
    <div className="max-w-4xl mx-auto p-6">
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
                        {postContentLength}/{POST_CONTENT_MAX_LENGTH}
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
                name="content_type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Content Type</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((contentType) => (
                          <SelectItem
                            key={contentType.value}
                            value={contentType.value}
                          >
                            {contentType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      errors={
                        form.formState.errors.content_type?.message
                          ? [
                              {
                                message:
                                  form.formState.errors.content_type.message,
                              },
                            ]
                          : undefined
                      }
                    />
                  </Field>
                )}
              />
            </div>

            <Controller
              name="target_audience"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Target Audience</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((audience) => (
                        <SelectItem key={audience.value} value={audience.value}>
                          {audience.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    errors={
                      form.formState.errors.target_audience?.message
                        ? [
                            {
                              message:
                                form.formState.errors.target_audience.message,
                            },
                          ]
                        : undefined
                    }
                  />
                </Field>
              )}
            />
          </CardContent>
        </Card>

        {/* Content Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center space-x-2 pb-2">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-xl">Content Details</CardTitle>
              <CardDescription>
                Describe the linked content and intent.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Controller
              name="content_summary"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel>Content Summary</FieldLabel>
                  <Textarea
                    placeholder="Brief summary of the linked content..."
                    className="min-h-[80px]"
                    {...field}
                  />
                  <FieldDescription>
                    A summary of what the linked content is about
                  </FieldDescription>
                  <FieldError
                    errors={
                      form.formState.errors.content_summary?.message
                        ? [
                            {
                              message:
                                form.formState.errors.content_summary.message,
                            },
                          ]
                        : undefined
                    }
                  />
                </Field>
              )}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Controller
                name="call_to_action_type"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Call to Action Type</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select CTA type" />
                      </SelectTrigger>
                      <SelectContent>
                        {CTA_TYPES.map((cta) => (
                          <SelectItem key={cta.value} value={cta.value}>
                            {cta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError
                      errors={
                        form.formState.errors.call_to_action_type?.message
                          ? [
                              {
                                message:
                                  form.formState.errors.call_to_action_type
                                    .message,
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

            <Controller
              name="sales_pitch_strength"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel className="flex items-center justify-between">
                    Sales Pitch Strength
                    <span className="text-sm font-medium">{field.value}%</span>
                  </FieldLabel>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                    className="w-full"
                  />
                  <FieldDescription>
                    How strong should the sales/promotional tone be? (0-100)
                  </FieldDescription>
                  <FieldError
                    errors={
                      form.formState.errors.sales_pitch_strength?.message
                        ? [
                            {
                              message:
                                form.formState.errors.sales_pitch_strength
                                  .message,
                            },
                          ]
                        : undefined
                    }
                  />
                </Field>
              )}
            />
          </CardContent>
        </Card>

        {/* Tone Profile Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center space-x-2">
              <Volume2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl">Tone Profile</CardTitle>
                <CardDescription>
                  Blend tones for nuanced voice.
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ tone: 'professional' as const, weight: 50 })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tone
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-end gap-4 p-4 border rounded-md bg-muted/50" // Subtle background for items
              >
                <Controller
                  name={`tone_profile.${index}.tone`}
                  control={form.control}
                  render={({ field: toneField }) => (
                    <Field className="flex-1">
                      <FieldLabel>Tone</FieldLabel>
                      <Select
                        onValueChange={toneField.onChange}
                        defaultValue={toneField.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                        <SelectContent>
                          {TONES.map((tone) => (
                            <SelectItem key={tone.value} value={tone.value}>
                              {tone.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError
                        errors={
                          form.formState.errors.tone_profile?.[index]?.tone
                            ?.message
                            ? [
                                {
                                  message:
                                    form.formState.errors.tone_profile?.[index]
                                      ?.tone?.message,
                                },
                              ]
                            : undefined
                        }
                      />
                    </Field>
                  )}
                />

                <Controller
                  name={`tone_profile.${index}.weight`}
                  control={form.control}
                  render={({ field: weightField }) => (
                    <Field className="flex-1">
                      <FieldLabel className="flex items-center justify-between">
                        Weight
                        <span className="text-sm font-medium">
                          {weightField.value}%
                        </span>
                      </FieldLabel>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[weightField.value]}
                        onValueChange={(value) =>
                          weightField.onChange(value[0])
                        }
                        className="w-full"
                      />
                      <FieldError
                        errors={
                          form.formState.errors.tone_profile?.[index]?.weight
                            ?.message
                            ? [
                                {
                                  message:
                                    form.formState.errors.tone_profile?.[index]
                                      ?.weight?.message,
                                },
                              ]
                            : undefined
                        }
                      />
                    </Field>
                  )}
                />

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {fields.length === 0 && (
              <p className="text-muted-foreground text-center py-6">
                No tone profiles added. Add at least one tone profile.
              </p>
            )}
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
