'use client';

import { useChat } from '@ai-sdk/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, easeOut, motion } from 'motion/react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Streamdown } from 'streamdown';
import * as z from 'zod/v4';

import { DefaultChatTransport } from 'ai';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { type StreamingPostMessage } from '~/lib/types/streaming';

// Default tone profile constants
const DEFAULT_TONE_WEIGHTS = {
  professional: 60,
  casual: 40,
} as const;

const DEFAULT_FORM_VALUES = {
  original_url: '',
  platform: 'twitter' as const,
  link_ownership_type: 'third_party_content' as const,
  tone_profile: [
    {
      tone: 'professional' as const,
      weight: DEFAULT_TONE_WEIGHTS.professional,
    },
    { tone: 'casual' as const, weight: DEFAULT_TONE_WEIGHTS.casual },
  ],
};

// Step configuration for the generation progress timeline
type StepData = Record<string, unknown>;

const STEP_CONFIG = {
  analyzing: {
    icon: <Search className="w-4 h-4" />,
    title: 'Analyzing Content',
    description: (data: StepData | undefined) =>
      data && 'content_type' in data
        ? `Found ${data.content_type} content for ${data.target_audience}`
        : 'Extracting insights from your URL',
  },
  searching: {
    icon: <FileText className="w-4 h-4" />,
    title: 'Finding Similar Posts',
    description: (data: StepData | undefined) =>
      data && 'count' in data
        ? `Found ${data.count} relevant examples`
        : 'Searching for similar content patterns',
  },
  generating: {
    icon: <Sparkles className="w-4 h-4" />,
    title: 'Generating Post',
    description: (data: StepData | undefined) =>
      data && 'platform' in data
        ? `Crafted for ${data.platform}`
        : 'Creating your perfect social media post',
  },
} as const;

// Timeline step component
interface TimelineStepProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  isLast?: boolean;
}

function TimelineStep({
  icon,
  title,
  description,
  status,
  isLast,
}: TimelineStepProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'loading':
        return 'text-blue-600 bg-blue-100 border-blue-200 animate-pulse';
      case 'error':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-400 bg-gray-100 border-gray-200';
    }
  };

  const getIconColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'loading':
        return 'text-blue-600 animate-pulse';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${getStatusColor()}`}
      >
        <div className={getIconColor()}>
          {status === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            icon
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <h3
            className={`text-sm font-medium ${
              status === 'completed'
                ? 'text-green-900'
                : status === 'loading'
                ? 'text-blue-900'
                : status === 'error'
                ? 'text-red-900'
                : 'text-gray-600'
            }`}
          >
            {title}
          </h3>
          {status === 'completed' && (
            <CheckCircle className="w-3 h-3 text-green-600" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-3 h-3 text-red-600" />
          )}
        </div>
        {description && (
          <p
            className={`text-xs ${
              status === 'completed'
                ? 'text-green-700'
                : status === 'loading'
                ? 'text-blue-700'
                : status === 'error'
                ? 'text-red-700'
                : 'text-gray-500'
            }`}
          >
            {description}
          </p>
        )}
      </div>
      {!isLast && <ChevronRight className="w-4 h-4 text-gray-300 mt-2" />}
    </div>
  );
}

/**
 * Props for the ToneSelector component
 */
interface ToneSelectorProps {
  /** Current array of tone selections with their weights */
  value: Array<{ tone: string; weight: number }>;
  /** Callback function called when tone selections change */
  onChange: (value: Array<{ tone: string; weight: number }>) => void;
}

/**
 * ToneSelector component allows users to select writing tones and assign weights to each tone.
 *
 * Features:
 * - Displays currently selected tones with weight inputs
 * - Shows available tones that can be added
 * - Validates that total weight doesn't exceed 100%
 * - Provides visual feedback for weight distribution
 *
 * @param props - The component props containing current value and change handler
 */
function ToneSelector({ value, onChange }: ToneSelectorProps) {
  const availableTones = [
    { value: 'witty', label: 'Witty', description: 'Clever and humorous' },
    {
      value: 'professional',
      label: 'Professional',
      description: 'Formal and business-like',
    },
    {
      value: 'inspirational',
      label: 'Inspirational',
      description: 'Motivational and uplifting',
    },
    {
      value: 'casual',
      label: 'Casual',
      description: 'Relaxed and conversational',
    },
    {
      value: 'direct',
      label: 'Direct',
      description: 'Straightforward and to the point',
    },
    {
      value: 'empathetic',
      label: 'Empathetic',
      description: 'Understanding and caring',
    },
  ];

  const addTone = (toneValue: string) => {
    if (!value.some((t) => t.tone === toneValue)) {
      onChange([...value, { tone: toneValue, weight: 0 }]);
    }
  };

  const removeTone = (toneValue: string) => {
    onChange(value.filter((t) => t.tone !== toneValue));
  };

  const updateWeight = (toneValue: string, weight: number) => {
    onChange(
      value.map((t) =>
        t.tone === toneValue
          ? { ...t, weight: Math.max(0, Math.min(100, weight)) }
          : t
      )
    );
  };

  const totalWeight = value.reduce((sum, tone) => sum + tone.weight, 0);
  const remainingWeight = 100 - totalWeight;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Tone Profile
        </label>
        <p className="text-xs text-muted-foreground">
          Select tones and assign weights (total should not exceed 100)
        </p>
      </div>

      {/* Selected tones */}
      <div className="space-y-2">
        {value.map((tone) => (
          <div
            key={tone.tone}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border border-border/50"
          >
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">
                {availableTones.find((t) => t.value === tone.tone)?.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {availableTones.find((t) => t.value === tone.tone)?.description}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={tone.weight}
                onChange={(e) =>
                  updateWeight(tone.tone, parseInt(e.target.value) || 0)
                }
                className="w-16 h-9 text-xs"
                placeholder="0"
              />
              <span className="text-xs text-muted-foreground w-8">%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeTone(tone.tone)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                ×
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Available tones to add */}
      {value.length < availableTones.length && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Add Tones
          </label>
          <div className="grid grid-cols-1 gap-3">
            {availableTones
              .filter(
                (tone) =>
                  !value.some((selected) => selected.tone === tone.value)
              )
              .map((tone) => (
                <Button
                  key={tone.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTone(tone.value)}
                  className="h-auto p-3 text-left justify-start border-border/50 hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {tone.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tone.description}
                    </div>
                  </div>
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Weight summary */}
      <div className="flex items-center justify-between p-3 bg-muted/20 rounded-md border border-border/30">
        <div className="text-sm text-foreground">
          <span className="font-medium">Total Weight:</span> {totalWeight}/100
        </div>
        <div
          className={`text-xs font-medium ${
            remainingWeight >= 0 ? 'text-muted-foreground' : 'text-destructive'
          }`}
        >
          {remainingWeight > 0
            ? `${remainingWeight} remaining`
            : remainingWeight < 0
            ? `${Math.abs(remainingWeight)} over limit`
            : 'Perfect!'}
        </div>
      </div>
    </div>
  );
}

// Form schema with tone profile selection
const createPostFormSchema = z.object({
  original_url: z.url('Must be a valid URL'),
  platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin'], {
    message: 'Please select a platform',
  }),
  link_ownership_type: z.enum(['own_content', 'third_party_content'], {
    message: 'Please select ownership type',
  }),
  tone_profile: z
    .array(
      z.object({
        tone: z.enum([
          'witty',
          'professional',
          'inspirational',
          'casual',
          'direct',
          'empathetic',
        ]),
        weight: z.number().min(0).max(100),
      })
    )
    .min(1, 'Please select at least one tone')
    .refine(
      (tones) => tones.reduce((sum, tone) => sum + tone.weight, 0) <= 100,
      'Total tone weights cannot exceed 100'
    ),
});

type CreatePostFormData = z.infer<typeof createPostFormSchema>;

interface GeneratePostFormProps {
  className?: string;
}

export function GeneratePostForm({ className }: GeneratePostFormProps) {
  // Store the current form data to send with the request
  const formDataRef = useRef<CreatePostFormData | null>(null);

  // Use AI SDK's useChat hook with custom typed messages and transport
  const { messages, sendMessage, status, error, clearError } =
    useChat<StreamingPostMessage>({
      transport: new DefaultChatTransport({
        api: '/api/posts/generate',
        prepareSendMessagesRequest: () => {
          return {
            body: formDataRef.current ?? {},
          };
        },
      }),
      onData: (dataPart) => {
        // Only handle transient notifications - all other data parts are persisted in messages
        if (dataPart.type === 'data-notification') {
          // Notifications are handled in the UI but not stored in state
        }
      },
      onError: (error) => {
        console.error('Chat error:', error);
      },
    });

  const isSubmitting = status === 'submitted' || status === 'streaming';

  // Derive data from message parts instead of separate state
  const lastMessage = messages[messages.length - 1];
  const contentAnalysis = lastMessage?.parts.find(
    (part) => part.type === 'data-content_analysis'
  )?.data;
  const trainingPosts = lastMessage?.parts.find(
    (part) => part.type === 'data-training_posts'
  )?.data;
  // Use the LAST occurrence of generated_post to get the latest streamed content
  const generatedPostParts = lastMessage?.parts.filter(
    (part) => part.type === 'data-generated_post'
  );
  const generatedPost =
    generatedPostParts?.[generatedPostParts.length - 1]?.data;

  // Extract notifications from messages for display
  const notifications = messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === 'data-notification')
    .map((part) => part.data);

  /**
   * Determines the status of each generation step based on current state and data availability.
   *
   * The function implements a state machine where each step transitions from 'pending' → 'loading' → 'completed'
   * based on the availability of data from the previous step and current submission status.
   *
   * @returns Array of step status objects with id, status, and data properties
   */
  const getStepStatuses = () => {
    // Early return if no activity - prevents showing empty progress when form is idle
    if (!isSubmitting && !contentAnalysis && !trainingPosts && !generatedPost) {
      return [];
    }

    const steps = [
      {
        id: 'analyzing',
        // Status logic: completed if data exists, loading if submitting, otherwise pending
        status: contentAnalysis
          ? 'completed'
          : isSubmitting
          ? 'loading'
          : 'pending',
        data: contentAnalysis,
      },
      {
        id: 'searching',
        // Status logic: completed if data exists, loading if previous step completed and still submitting, otherwise pending
        status: trainingPosts
          ? 'completed'
          : contentAnalysis && isSubmitting
          ? 'loading'
          : 'pending',
        data: trainingPosts,
      },
      {
        id: 'generating',
        // Status logic: completed if data exists, loading if previous step completed and still submitting, otherwise pending
        status: generatedPost
          ? 'completed'
          : trainingPosts && isSubmitting
          ? 'loading'
          : 'pending',
        data: generatedPost,
      },
    ];
    return steps;
  };

  const stepStatuses = getStepStatuses();

  // Check if progress section should be shown
  const shouldShowProgress =
    isSubmitting || messages.length > 0 || error || notifications.length > 0;

  const form = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const resetForm = () => {
    form.reset(DEFAULT_FORM_VALUES);
    clearError();
  };

  const onSubmit = async (data: CreatePostFormData) => {
    // Clear any previous errors
    clearError();

    // Store the form data in the ref so it can be accessed by prepareSendMessagesRequest
    formDataRef.current = data;

    // Use AI SDK's sendMessage to trigger the streaming
    // Send a placeholder user message since our backend doesn't use chat messages
    sendMessage({
      role: 'user',
      parts: [{ type: 'text', text: 'Generate post' }],
    });
  };

  // Motion variants
  const fadeInUp = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.18, ease: easeOut },
  };

  return (
    <div className={className}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`grid gap-6 lg:gap-8 ${
            shouldShowProgress || generatedPost
              ? 'lg:grid-cols-2'
              : 'lg:grid-cols-1 lg:max-w-2xl lg:mx-auto'
          }`}
        >
          <Card className="shadow-sm border border-border/50">
            <CardContent className="space-y-5 pt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-5"
                >
                  <FormField
                    control={form.control}
                    name="original_url"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm font-medium text-foreground">
                          URL *
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/article"
                            className="h-10 transition-colors focus:ring-2 focus:ring-primary/20"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-muted-foreground">
                          The URL you want to create a social media post about
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-sm font-medium text-foreground">
                          Platform *
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 transition-colors focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="link_ownership_type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-sm font-medium text-foreground">
                            Content Ownership *
                          </FormLabel>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-sm transition-colors ${
                                !field.value ||
                                field.value === 'third_party_content'
                                  ? 'text-muted-foreground'
                                  : 'text-foreground font-medium'
                              }`}
                            >
                              Third Party
                            </span>
                            <Switch
                              checked={field.value === 'own_content'}
                              onCheckedChange={(checked) => {
                                field.onChange(
                                  checked
                                    ? 'own_content'
                                    : 'third_party_content'
                                );
                              }}
                              className="data-[state=checked]:bg-primary"
                            />
                            <span
                              className={`text-sm transition-colors ${
                                field.value === 'own_content'
                                  ? 'text-foreground font-medium'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              My Own
                            </span>
                          </div>
                        </div>
                        <FormDescription className="text-xs text-muted-foreground">
                          Toggle to indicate whether this is your own content or
                          third-party content
                        </FormDescription>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tone_profile"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <ToneSelector
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="pt-1">
                    <Button
                      type="submit"
                      className="w-full h-11 text-base font-medium transition-all hover:shadow-md"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Post...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Social Media Post
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Second column content - either progress or generated post */}
          {(shouldShowProgress || generatedPost || error) && (
            <div className="space-y-4">
              {shouldShowProgress && (
                <Card className="shadow-sm border border-border/50">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <CardTitle className="text-base font-semibold">
                        Generation Progress
                      </CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      AI-powered content generation in real-time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Timeline of steps */}
                    <div className="space-y-4">
                      {stepStatuses.map((step, index) => {
                        const config =
                          STEP_CONFIG[step.id as keyof typeof STEP_CONFIG];
                        const description = config.description(step.data);

                        return (
                          <TimelineStep
                            key={step.id}
                            icon={config.icon}
                            title={config.title}
                            description={description}
                            status={
                              step.status as
                                | 'pending'
                                | 'loading'
                                | 'completed'
                                | 'error'
                            }
                            isLast={index === stepStatuses.length - 1}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generated Post - Only show when complete */}
              {generatedPost && (
                <AnimatePresence>
                  <motion.div
                    key="generated-post"
                    layout
                    initial={fadeInUp.initial}
                    animate={fadeInUp.animate}
                    exit={fadeInUp.exit}
                    transition={fadeInUp.transition}
                  >
                    <Card className="shadow-sm border border-green-200/60 bg-green-50/20">
                      <CardHeader className="pb-4 bg-green-50/40 border-b border-green-200/40">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-100">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg font-semibold text-green-800">
                              Post Generated Successfully
                            </CardTitle>
                            <CardDescription className="text-sm text-green-700">
                              Ready to share on {generatedPost.platform}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="p-5 bg-white/90 rounded-lg border border-green-100/80 shadow-sm">
                          <Streamdown
                            className="prose prose-sm max-w-none text-slate-800"
                            parseIncompleteMarkdown={true}
                            controls={true}
                            isAnimating={status === 'streaming'}
                          >
                            {generatedPost.content}
                          </Streamdown>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            variant="outline"
                            className="h-10 px-4 border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 min-w-0 flex-1 sm:flex-initial"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                generatedPost.content
                              );
                              toast.success('Copied to clipboard');
                            }}
                          >
                            Copy to Clipboard
                          </Button>
                          <Button
                            variant="outline"
                            className="h-10 px-4 border-slate-200 hover:bg-slate-50 min-w-0 flex-1 sm:flex-initial"
                            onClick={resetForm}
                          >
                            Create Another
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Error State */}
              {error && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <CardTitle className="text-base font-semibold text-destructive">
                        Error
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-destructive">{error.message}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
