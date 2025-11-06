'use client';

import { useChat } from '@ai-sdk/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, easeOut, motion } from 'motion/react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Streamdown } from 'streamdown';
import * as z from 'zod/v4';

import { DefaultChatTransport } from 'ai';
import { AlertCircle, CheckCircle, Loader2, Sparkles, Zap } from 'lucide-react';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { SingleSelect } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { type StreamingPostMessage } from '~/lib/types/streaming';
import { CpuIcon } from '../ui/cpu';
import { FileTextIcon } from '../ui/file-text';
import { PenToolIcon } from '../ui/pen-tool';

// Default tone profile constants
const DEFAULT_TONE_WEIGHTS = {
  direct: 60,
  inspirational: 40,
} as const;

// Platform and ownership type options
type OptionItem = { value: string; label: string };

const PLATFORMS: OptionItem[] = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const DEFAULT_FORM_VALUES = {
  original_url: '',
  platform: 'twitter' as const,
  link_ownership_type: 'third_party_content' as const,
  tone_profile: [
    {
      tone: 'direct' as const,
      weight: DEFAULT_TONE_WEIGHTS.direct,
    },
    {
      tone: 'inspirational' as const,
      weight: DEFAULT_TONE_WEIGHTS.inspirational,
    },
  ],
};

// Step configuration for the generation progress timeline
type StepData = Record<string, unknown>;

const getStepConfig = () =>
  ({
    analyzing: {
      icon: <CpuIcon size={14} className="shrink-0" />,
      title: 'Analyzing Content',
      description: (data: StepData | undefined) =>
        data && 'content_type' in data
          ? `Found ${data.content_type} content for ${data.target_audience}`
          : 'Extracting insights from your URL',
    },
    searching: {
      icon: <FileTextIcon size={14} className="shrink-0" />,
      title: 'Finding Similar Posts',
      description: (data: StepData | undefined) =>
        data && 'count' in data
          ? `Found ${data.count} relevant examples`
          : 'Searching for similar content patterns',
    },
    generating: {
      icon: <PenToolIcon size={14} className="shrink-0" />,
      title: 'Generating Post',
      description: (data: StepData | undefined) =>
        data && 'platform' in data
          ? `Crafted for ${data.platform}`
          : 'Creating your perfect social media post',
    },
  } as const);

// Timeline step component with animations
interface TimelineStepProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  isLast?: boolean;
  index: number;
}

function TimelineStep({
  icon,
  title,
  description,
  status,
  isLast,
  index,
}: TimelineStepProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-[var(--color-status-done)] bg-[var(--color-success-card-bg)] border-[var(--color-success-border)]';
      case 'loading':
        return 'text-[var(--color-status-in-progress)] bg-muted border-border';
      case 'error':
        return 'text-[var(--color-status-cancelled)] bg-muted border-border';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getIconColor = () => {
    switch (status) {
      case 'completed':
        return 'text-[var(--color-status-done)]';
      case 'loading':
        return 'text-[var(--color-status-in-progress)]';
      case 'error':
        return 'text-[var(--color-status-cancelled)]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTitleColor = () => {
    switch (status) {
      case 'completed':
        return 'text-[var(--color-success-title)]';
      case 'loading':
        return 'text-foreground';
      case 'error':
        return 'text-[var(--color-status-cancelled)]';
      default:
        return 'text-muted-foreground';
    }
  };

  const getDescriptionColor = () => {
    switch (status) {
      case 'completed':
        return 'text-[var(--color-success-description)]';
      case 'loading':
        return 'text-muted-foreground';
      case 'error':
        return 'text-[var(--color-status-cancelled)]';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{
        duration: 0.2,
        delay: index * 0.05,
      }}
      className="relative"
    >
      <div className="flex items-start gap-2.5">
        {/* Icon with enhanced animations */}
        <motion.div
          animate={
            status === 'loading'
              ? {
                  scale: [1, 1.05, 1],
                }
              : {}
          }
          transition={{
            duration: 1.5,
            repeat: status === 'loading' ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className={`relative flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-300 ${getStatusColor()}`}
        >
          <motion.div
            animate={{ scale: [1, 1.04, 1], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className={getIconColor()}
          >
            {status === 'loading' ? (
              icon
            ) : status === 'completed' ? (
              <CheckCircle className="w-4 h-4" />
            ) : status === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              icon
            )}
          </motion.div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-6">
          <div className="space-y-0.5">
            <h3
              className={`text-xs font-semibold transition-colors duration-300 ${getTitleColor()}`}
            >
              {title}
            </h3>
            <AnimatePresence mode="wait">
              {description && (
                <motion.p
                  key={description}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-xs leading-relaxed transition-colors duration-300 ${getDescriptionColor()}`}
                >
                  {description}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Connector line */}
        {!isLast && (
          <div className="absolute left-3.5 top-7 w-px h-full -mb-6 bg-gray-200" />
        )}
      </div>
    </motion.div>
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
      // Assign the remaining weight to the new tone, or a default of 10 if none remains
      const totalWeight = value.reduce((sum, tone) => sum + tone.weight, 0);
      const remainingWeight = 100 - totalWeight;
      const newWeight = remainingWeight > 0 ? remainingWeight : 0;
      onChange([...value, { tone: toneValue, weight: newWeight }]);
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
    <div className="space-y-3">
      <div className="space-y-0.5">
        <label className="text-xs font-semibold text-foreground">
          Tone Profile
        </label>
        <p className="text-xs text-muted-foreground">
          Assign weights (total = 100)
        </p>
      </div>

      {/* Selected tones */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-1.5">
          {value.map((tone, index) => (
            <motion.div
              key={tone.tone}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.2,
                delay: index * 0.03,
              }}
              layout
              className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-foreground">
                  {availableTones.find((t) => t.value === tone.tone)?.label}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={tone.weight}
                  onChange={(e) =>
                    updateWeight(tone.tone, parseInt(e.target.value) || 0)
                  }
                  className="w-14 h-7 text-xs font-medium text-center"
                  placeholder="0"
                />
                <span className="text-xs font-medium text-muted-foreground w-4">
                  %
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTone(tone.tone)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  ×
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* Available tones to add */}
      {value.length < availableTones.length && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-1.5"
        >
          <label className="text-xs font-semibold text-muted-foreground">
            Add More
          </label>
          <div className="flex flex-wrap gap-1.5">
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
                  className="h-7 px-2.5 text-xs border-dashed hover:bg-muted/50 hover:border-primary/50"
                >
                  {tone.label}
                </Button>
              ))}
          </div>
        </motion.div>
      )}

      {/* Weight summary with progress bar */}
      <motion.div
        layout
        className={`p-2.5 rounded-lg border transition-all duration-300 ${
          remainingWeight === 0
            ? 'bg-[var(--color-success-card-bg)] border-[var(--color-success-card-border)]'
            : remainingWeight < 0
            ? 'bg-muted border-border'
            : 'bg-muted/20 border-border/30'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-foreground">
            <span className="font-semibold">Total:</span>{' '}
            <span className="font-bold">{totalWeight}</span>/100
          </div>
          <motion.div
            key={remainingWeight}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              remainingWeight === 0
                ? 'bg-[color-mix(in_srgb,var(--color-status-done),var(--color-card)_90%)] text-[var(--color-success-button-text)]'
                : remainingWeight < 0
                ? 'bg-muted text-[var(--color-status-cancelled)]'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {remainingWeight > 0
              ? `${remainingWeight} left`
              : remainingWeight < 0
              ? `${Math.abs(remainingWeight)} over`
              : '✓'}
          </motion.div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(totalWeight, 100)}%` }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={`h-full transition-colors duration-300 ${
              remainingWeight === 0
                ? 'bg-[var(--color-status-done)]'
                : remainingWeight < 0
                ? 'bg-[var(--color-status-cancelled)]'
                : 'bg-primary'
            }`}
          />
        </div>
      </motion.div>
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
      (tones) => tones.reduce((sum, tone) => sum + tone.weight, 0) === 100,
      'Total tone weights must sum to exactly 100'
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
        // Handle transient notifications with toast feedback
        if (dataPart.type === 'data-notification') {
          const notification = dataPart.data;
          if (notification.level === 'error') {
            toast.error(notification.message);
          } else if (notification.level === 'success') {
            toast.success(notification.message);
          } else if (notification.level === 'warning') {
            toast.warning(notification.message);
          } else if (notification.level === 'info') {
            toast.info(notification.message);
          }
        }
      },
      onError: (error) => {
        console.error('Chat error:', error);
        toast.error(error.message || 'An unexpected error occurred');
      },
    });

  const isSubmitting = status === 'submitted' || status === 'streaming';

  // Derive data from message parts instead of separate state
  // With stable IDs, each data type appears only once and gets updated in place
  const lastMessage = messages[messages.length - 1];
  const contentAnalysis = lastMessage?.parts.find(
    (part) => part.type === 'data-content_analysis'
  )?.data;
  const trainingPosts = lastMessage?.parts.find(
    (part) => part.type === 'data-training_posts'
  )?.data;
  // With stable ID, generated_post is automatically updated in place
  const generatedPost = lastMessage?.parts.find(
    (part) => part.type === 'data-generated_post'
  )?.data;

  // Extract progress messages to determine step statuses and errors
  // With stable IDs, each stage has only one progress message that updates in place
  const progressMessages = messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === 'data-progress')
    .map((part) => part.data);

  // Extract notifications from messages for display
  const notifications = messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === 'data-notification')
    .map((part) => part.data);

  // Find error notifications to display
  const errorNotifications = notifications.filter((n) => n.level === 'error');
  const hasApplicationError = errorNotifications.length > 0;

  /**
   * Determines the status of each generation step based on current state and data availability.
   *
   * The function implements a state machine where each step transitions from 'pending' → 'loading' → 'completed' → 'error'
   * based on the availability of data from the previous step, current submission status, and error progress messages.
   *
   * Only returns steps that have started (not pending), creating a progressive reveal effect.
   *
   * @returns Array of step status objects with id, status, and data properties
   */
  const getStepStatuses = () => {
    // Early return if no activity - prevents showing empty progress when form is idle
    if (
      !isSubmitting &&
      !contentAnalysis &&
      !trainingPosts &&
      !generatedPost &&
      progressMessages.length === 0
    ) {
      return [];
    }

    // Helper to check if a stage has an error progress message
    const hasStageError = (stageId: string) => {
      const stageMapping: Record<string, string[]> = {
        analyzing: ['scraping', 'analyzing'],
        searching: ['searching'],
        generating: ['generating', 'saving'],
      };
      const stages = stageMapping[stageId] || [];
      return progressMessages.some(
        (msg) => stages.includes(msg.stage) && msg.status === 'error'
      );
    };

    const allSteps = [
      {
        id: 'analyzing',
        // Status logic: error if stage has error, completed if data exists, loading if submitting, otherwise pending
        status: hasStageError('analyzing')
          ? 'error'
          : contentAnalysis
          ? 'completed'
          : isSubmitting
          ? 'loading'
          : 'pending',
        data: contentAnalysis,
      },
      {
        id: 'searching',
        // Status logic: error if stage has error, completed if data exists, loading if previous step completed and still submitting, otherwise pending
        status: hasStageError('searching')
          ? 'error'
          : trainingPosts
          ? 'completed'
          : contentAnalysis && isSubmitting
          ? 'loading'
          : 'pending',
        data: trainingPosts,
      },
      {
        id: 'generating',
        // Status logic: error if stage has error, completed if data exists, loading if previous step completed and still submitting, otherwise pending
        status: hasStageError('generating')
          ? 'error'
          : generatedPost
          ? 'completed'
          : trainingPosts && isSubmitting
          ? 'loading'
          : 'pending',
        data: generatedPost,
      },
    ];

    // Only show steps that have started (not pending) for progressive reveal
    return allSteps.filter((step) => step.status !== 'pending');
  };

  const stepStatuses = getStepStatuses();

  // Check if progress section should be shown
  const shouldShowProgress =
    isSubmitting || messages.length > 0 || error || hasApplicationError;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          layout
          className={`grid gap-4 lg:gap-6 transition-all duration-500 ${
            shouldShowProgress || generatedPost
              ? 'lg:grid-cols-[400px_1fr]'
              : 'lg:grid-cols-1 lg:max-w-2xl lg:mx-auto'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="lg:h-fit lg:sticky lg:top-4"
          >
            <Card className="shadow-lg border border-border/50 overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50 relative">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <motion.div
                      animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1] }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Sparkles className="w-4 h-4 text-primary" />
                    </motion.div>
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-bold">
                      Generate Social Post
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      AI-powered content creation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 relative">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-3.5"
                  >
                    <FormField
                      control={form.control}
                      name="original_url"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            URL *
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/article"
                              className="h-9 text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="platform"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-xs font-semibold text-foreground">
                            Platform *
                          </FormLabel>
                          <FormControl>
                            <SingleSelect
                              options={PLATFORMS}
                              value={field.value}
                              setValue={field.onChange}
                              getLabel={(option) => option.label}
                              getValue={(option) => option.value}
                              placeholder="Select platform"
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="link_ownership_type"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-xs font-semibold text-foreground">
                              Content Ownership *
                            </FormLabel>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-xs transition-colors ${
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
                                className={`text-xs transition-colors ${
                                  field.value === 'own_content'
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                My Own
                              </span>
                            </div>
                          </div>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tone_profile"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
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

                    <div className="pt-2">
                      <Button
                        type="submit"
                        className="w-full h-10 text-sm font-semibold"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Post
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Second column content - either progress or generated post */}
          {(shouldShowProgress ||
            generatedPost ||
            error ||
            hasApplicationError) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-4"
            >
              {shouldShowProgress && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="shadow-lg border border-border overflow-hidden relative">
                    {/* Animated top border when loading */}
                    {isSubmitting && (
                      <motion.div
                        className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-status-in-progress)]"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: 3,
                          ease: 'easeInOut',
                          repeat: Infinity,
                        }}
                      />
                    )}
                    <CardHeader className="pb-3 relative">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <motion.div
                            animate={{
                              rotate: [0, 10, -10, 0],
                              scale: [1, 1.06, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          >
                            <Zap className="w-4 h-4 text-primary" />
                          </motion.div>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base font-bold">
                            Generation Progress
                          </CardTitle>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5">
                            {isSubmitting ? 'Processing...' : 'Complete'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {/* Timeline of steps with progressive reveal */}
                      <AnimatePresence mode="sync">
                        <div className="space-y-0">
                          {stepStatuses.map((step, index) => {
                            const STEP_CONFIG = getStepConfig();
                            const config =
                              STEP_CONFIG[
                                step.id as keyof ReturnType<
                                  typeof getStepConfig
                                >
                              ];
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
                                index={index}
                              />
                            );
                          })}
                        </div>
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Error Notifications */}
              {hasApplicationError &&
                errorNotifications.map((notification, index) => (
                  <AnimatePresence key={`error-${index}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="border-[var(--color-success-border)] overflow-hidden relative shadow-lg">
                        <CardHeader className="pb-3 relative">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-[var(--color-destructive)]/10">
                              <AlertCircle className="w-4 h-4 text-[var(--color-destructive)]" />
                            </div>
                            <CardTitle className="text-base font-bold text-[var(--color-destructive)]">
                              Error
                            </CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="relative space-y-3">
                          <p className="text-sm text-[var(--color-destructive-foreground)]">
                            {notification.message}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resetForm}
                            className="h-9 px-3 text-xs border-[var(--color-destructive)]/40 text-[var(--color-destructive-foreground)] hover:bg-[var(--color-destructive)]/10 hover:border-[var(--color-destructive)]/60 font-medium"
                          >
                            Try Again
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </AnimatePresence>
                ))}

              {/* Generated Post - Only show when complete and no errors */}
              {generatedPost && !hasApplicationError && (
                <AnimatePresence>
                  <motion.div
                    key="generated-post"
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="shadow-lg border-[var(--color-success-card-border)] overflow-hidden relative">
                      <CardHeader className="pb-3 relative border-b border-[var(--color-success-card-border)]">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-[var(--color-success-icon-bg)]">
                            <motion.div
                              animate={{
                                scale: [1, 1.08, 1],
                                rotate: [0, 6, -6, 0],
                              }}
                              transition={{
                                duration: 2.2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <CheckCircle className="w-4 h-4 text-[var(--color-status-done)]" />
                            </motion.div>
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-base font-bold text-[var(--color-success-title)]">
                              Generated Post
                            </CardTitle>
                            <CardDescription className="text-xs text-[var(--color-success-description)] mt-0.5">
                              Ready for {generatedPost.platform}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-4 relative">
                        <div className="p-4 bg-card rounded-lg border border-[var(--color-success-card-border)] relative overflow-hidden">
                          {/* Animated border glow effect */}
                          {status === 'streaming' && (
                            <motion.div
                              className="absolute inset-0 border border-[var(--color-success-border)] rounded-lg"
                              animate={{
                                opacity: [0.5, 1, 0.5],
                              }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            />
                          )}
                          <Streamdown
                            className="prose prose-sm max-w-none text-foreground relative [&_p]:my-2 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:mt-2 [&_h3]:mb-1"
                            parseIncompleteMarkdown={true}
                            controls={true}
                            isAnimating={status === 'streaming'}
                          >
                            {generatedPost.content}
                          </Streamdown>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 text-xs border-[var(--color-success-button-border)] text-[var(--color-success-button-text)] hover:bg-[var(--color-success-button-bg-hover)] hover:border-[var(--color-success-border-hover)] font-medium flex-1"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                generatedPost.content
                              );
                              toast.success('Copied to clipboard');
                            }}
                          >
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 text-xs border-border hover:bg-muted font-medium flex-1"
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

              {/* Transport/Network Error State (separate from application errors) */}
              {error && !hasApplicationError && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="border-[var(--color-success-border)] overflow-hidden relative shadow-lg">
                      <CardHeader className="pb-3 relative">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-[var(--color-destructive)]/10">
                            <motion.div
                              animate={{ scale: [1, 1.06, 1] }}
                              transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <AlertCircle className="w-4 h-4 text-[var(--color-destructive)]" />
                            </motion.div>
                          </div>
                          <div className="p-1.5 rounded-lg bg-[var(--color-destructive)]/10">
                            <motion.div
                              animate={{ scale: [1, 1.06, 1] }}
                              transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                            >
                              <AlertCircle className="w-4 h-4 text-[var(--color-destructive)]" />
                            </motion.div>
                          </div>
                          <CardTitle className="text-base font-bold text-[var(--color-destructive)]">
                            Connection Error
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="relative space-y-3">
                        <p className="text-sm text-[var(--color-destructive-foreground)]">
                          {error.message}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetForm}
                          className="h-9 px-3 text-xs border-[var(--color-destructive)]/40 text-[var(--color-destructive-foreground)] hover:bg-[var(--color-destructive)]/10 hover:border-[var(--color-destructive)]/60 font-medium"
                        >
                          Try Again
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
