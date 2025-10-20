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
import { CpuIcon } from '~/components/ui/cpu';
import { FileTextIcon } from '~/components/ui/file-text';
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
import { PenToolIcon } from '~/components/ui/pen-tool';
import { SelectWithComboboxAPI, type Item } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { type StreamingPostMessage } from '~/lib/types/streaming';

// Default tone profile constants
const DEFAULT_TONE_WEIGHTS = {
  direct: 60,
  inspirational: 40,
} as const;

// Platform and ownership type options
const PLATFORMS: Item[] = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const OWNERSHIP_TYPES: Item[] = [
  { value: 'own_content', label: 'My Own' },
  { value: 'third_party_content', label: 'Third Party' },
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
      icon: <CpuIcon size={18} className="shrink-0" />,
      title: 'Analyzing Content',
      description: (data: StepData | undefined) =>
        data && 'content_type' in data
          ? `Found ${data.content_type} content for ${data.target_audience}`
          : 'Extracting insights from your URL',
    },
    searching: {
      icon: <FileTextIcon size={18} className="shrink-0" />,
      title: 'Finding Similar Posts',
      description: (data: StepData | undefined) =>
        data && 'count' in data
          ? `Found ${data.count} relevant examples`
          : 'Searching for similar content patterns',
    },
    generating: {
      icon: <PenToolIcon size={18} className="shrink-0" />,
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
        return 'text-emerald-600 bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100';
      case 'loading':
        return 'text-blue-600 bg-blue-50 border-blue-300 shadow-sm shadow-blue-100';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200 shadow-sm shadow-red-100';
      default:
        return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  const getIconColor = () => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600';
      case 'loading':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  const getTitleColor = () => {
    switch (status) {
      case 'completed':
        return 'text-emerald-900';
      case 'loading':
        return 'text-blue-900';
      case 'error':
        return 'text-red-900';
      default:
        return 'text-gray-600';
    }
  };

  const getDescriptionColor = () => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700';
      case 'loading':
        return 'text-blue-700';
      case 'error':
        return 'text-red-700';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{
        duration: 0.4,
        delay: index * 0.1,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative"
    >
      <div className="flex items-start gap-4">
        {/* Icon with enhanced animations */}
        <motion.div
          animate={
            status === 'loading'
              ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: status === 'loading' ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className={`relative flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${getStatusColor()}`}
        >
          <div className={getIconColor()}>
            {status === 'loading' ? (
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {icon}
              </motion.div>
            ) : status === 'completed' ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <CheckCircle className="w-5 h-5" />
              </motion.div>
            ) : status === 'error' ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <AlertCircle className="w-5 h-5" />
              </motion.div>
            ) : (
              icon
            )}
          </div>

          {/* Pulse effect for loading state */}
          {status === 'loading' && (
            <motion.div
              className="absolute inset-0 rounded-xl bg-blue-400"
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm font-semibold transition-colors duration-300 ${getTitleColor()}`}
              >
                {title}
              </h3>
            </div>
            <AnimatePresence mode="wait">
              {description && (
                <motion.p
                  key={description}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-xs leading-relaxed transition-colors duration-300 ${getDescriptionColor()}`}
                >
                  {description}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Connector line */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.4 }}
            className="absolute left-5 top-10 w-0.5 h-full -mb-8 bg-gradient-to-b from-gray-300 to-transparent origin-top"
          />
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
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-semibold text-foreground">
          Tone Profile
        </label>
        <p className="text-xs text-muted-foreground">
          Select tones and assign weights (total should equal 100)
        </p>
      </div>

      {/* Selected tones */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
          {value.map((tone, index) => (
            <motion.div
              key={tone.tone}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1],
              }}
              layout
              className="flex items-center gap-3 p-3 bg-gradient-to-r from-muted/40 to-muted/20 rounded-lg border border-border/50 shadow-sm hover:shadow-md hover:border-border transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground">
                  {availableTones.find((t) => t.value === tone.tone)?.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {
                    availableTones.find((t) => t.value === tone.tone)
                      ?.description
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={tone.weight}
                  onChange={(e) =>
                    updateWeight(tone.tone, parseInt(e.target.value) || 0)
                  }
                  className="w-16 h-9 text-sm font-medium text-center shadow-sm transition-all duration-200 focus:ring-2 focus:ring-primary/30"
                  placeholder="0"
                />
                <span className="text-sm font-medium text-muted-foreground w-6">
                  %
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTone(tone.tone)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-200"
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
          transition={{ duration: 0.3 }}
          className="space-y-2"
        >
          <label className="text-sm font-semibold text-muted-foreground">
            Add More Tones
          </label>
          <div className="grid grid-cols-1 gap-2">
            {availableTones
              .filter(
                (tone) =>
                  !value.some((selected) => selected.tone === tone.value)
              )
              .map((tone, index) => (
                <motion.div
                  key={tone.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTone(tone.value)}
                    className="w-full h-auto p-3 text-left justify-start border-dashed border-border/50 hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                          {tone.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {tone.description}
                        </div>
                      </div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        +
                      </motion.div>
                    </div>
                  </Button>
                </motion.div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Weight summary with progress bar */}
      <motion.div
        layout
        className={`p-4 rounded-lg border transition-all duration-300 ${
          remainingWeight === 0
            ? 'bg-emerald-50/50 border-emerald-200/50 shadow-sm shadow-emerald-100/50'
            : remainingWeight < 0
            ? 'bg-red-50/50 border-red-200/50 shadow-sm shadow-red-100/50'
            : 'bg-muted/20 border-border/30'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-foreground">
            <span className="font-semibold">Total Weight:</span>{' '}
            <span className="font-bold">{totalWeight}</span>/100
          </div>
          <motion.div
            key={remainingWeight}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              remainingWeight === 0
                ? 'bg-emerald-100 text-emerald-700'
                : remainingWeight < 0
                ? 'bg-red-100 text-red-700'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {remainingWeight > 0
              ? `${remainingWeight} remaining`
              : remainingWeight < 0
              ? `${Math.abs(remainingWeight)} over`
              : '✓ Perfect!'}
          </motion.div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(totalWeight, 100)}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className={`h-full transition-colors duration-300 ${
              remainingWeight === 0
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : remainingWeight < 0
                ? 'bg-gradient-to-r from-red-500 to-red-400'
                : 'bg-gradient-to-r from-primary to-primary/80'
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

  // Extract progress messages to determine step statuses and errors
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          layout
          className={`grid gap-6 lg:gap-8 transition-all duration-500 ${
            shouldShowProgress || generatedPost
              ? 'lg:grid-cols-2'
              : 'lg:grid-cols-1 lg:max-w-2xl lg:mx-auto'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <Card className="shadow-lg border border-border/50 bg-gradient-to-br from-card to-card/95 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-transparent pointer-events-none" />
              <CardHeader className="pb-4 border-b border-border/50 relative">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ rotate: -10, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 200,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-sm"
                  >
                    <Sparkles className="w-5 h-5 text-primary" />
                  </motion.div>
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold">
                      Generate Social Post
                    </CardTitle>
                    <CardDescription className="text-sm mt-0.5">
                      AI-powered content creation from any URL
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6 relative">
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
                          <FormLabel className="text-sm font-semibold text-foreground">
                            URL *
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/article"
                              className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm"
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
                          <FormLabel className="text-sm font-semibold text-foreground">
                            Platform *
                          </FormLabel>
                          <FormControl>
                            <SelectWithComboboxAPI
                              options={PLATFORMS}
                              value={field.value}
                              setValue={field.onChange}
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
                        <FormItem className="space-y-3">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-sm font-semibold text-foreground">
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
                            Toggle to indicate whether this is your own content
                            or third-party content
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
                        className="w-full h-12 text-base font-semibold transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-primary to-primary/90"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating Post...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Generate Social Media Post
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
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                >
                  <Card className="shadow-lg border border-border/50 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm overflow-hidden relative">
                    {/* Animated top border when loading */}
                    {isSubmitting && (
                      <motion.div
                        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: 3,
                          ease: 'easeInOut',
                          repeat: Infinity,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                    <CardHeader className="pb-4 relative">
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{
                            rotate: isSubmitting ? [0, 10, -10, 0] : 0,
                            scale: isSubmitting ? [1, 1.1, 1] : 1,
                          }}
                          transition={{
                            duration: 2,
                            repeat: isSubmitting ? Infinity : 0,
                            ease: 'easeInOut',
                          }}
                          className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-sm"
                        >
                          <Zap className="w-5 h-5 text-primary" />
                        </motion.div>
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Generation Progress
                          </CardTitle>
                          <CardDescription className="text-sm text-muted-foreground mt-0.5">
                            {isSubmitting
                              ? 'AI is working its magic...'
                              : 'Generation complete'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
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
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <Card className="border-red-200/50 bg-gradient-to-br from-red-50/50 to-card overflow-hidden relative shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent pointer-events-none" />
                        <CardHeader className="pb-3 relative">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 200,
                              damping: 20,
                              delay: 0.1,
                            }}
                            className="flex items-center gap-3"
                          >
                            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-400/10 shadow-sm">
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <CardTitle className="text-base font-bold text-red-900">
                              Error
                            </CardTitle>
                          </motion.div>
                        </CardHeader>
                        <CardContent className="relative">
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-sm text-red-700"
                          >
                            {notification.message}
                          </motion.p>
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mt-4"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetForm}
                              className="h-10 px-4 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-all duration-200 font-medium"
                            >
                              Try Again
                            </Button>
                          </motion.div>
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
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Card className="shadow-xl border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-card overflow-hidden relative">
                      {/* Success confetti effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

                      <CardHeader className="pb-4 relative border-b border-emerald-200/50">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 20,
                            delay: 0.2,
                          }}
                          className="flex items-center gap-3"
                        >
                          <motion.div
                            animate={{
                              rotate: [0, 10, -10, 0],
                            }}
                            transition={{
                              duration: 0.6,
                              delay: 0.3,
                            }}
                            className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-400/10 shadow-sm"
                          >
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                          </motion.div>
                          <div className="flex-1">
                            <CardTitle className="text-lg font-bold text-emerald-900">
                              Post Generated Successfully
                            </CardTitle>
                            <CardDescription className="text-sm text-emerald-700/80 mt-0.5">
                              Ready to share on {generatedPost.platform}
                            </CardDescription>
                          </div>
                        </motion.div>
                      </CardHeader>
                      <CardContent className="space-y-5 pt-5 relative">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3, duration: 0.4 }}
                          className="p-5 bg-card rounded-xl border border-emerald-200/50 shadow-sm relative overflow-hidden"
                        >
                          {/* Animated border glow effect */}
                          {status === 'streaming' && (
                            <motion.div
                              className="absolute inset-0 border-2 border-emerald-400/30 rounded-xl"
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
                            className="prose prose-sm max-w-none text-foreground relative"
                            parseIncompleteMarkdown={true}
                            controls={true}
                            isAnimating={status === 'streaming'}
                          >
                            {generatedPost.content}
                          </Streamdown>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                          className="flex flex-col sm:flex-row gap-3"
                        >
                          <Button
                            variant="outline"
                            className="h-11 px-5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all duration-200 min-w-0 flex-1 sm:flex-initial font-medium shadow-sm"
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
                            className="h-11 px-5 border-border hover:bg-muted hover:border-border/80 transition-all duration-200 min-w-0 flex-1 sm:flex-initial font-medium shadow-sm"
                            onClick={resetForm}
                          >
                            Create Another
                          </Button>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Transport/Network Error State (separate from application errors) */}
              {error && !hasApplicationError && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Card className="border-red-200/50 bg-gradient-to-br from-red-50/50 to-card overflow-hidden relative shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-transparent pointer-events-none" />
                      <CardHeader className="pb-3 relative">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 200,
                            damping: 20,
                            delay: 0.1,
                          }}
                          className="flex items-center gap-3"
                        >
                          <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-400/10 shadow-sm">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          </div>
                          <CardTitle className="text-base font-bold text-red-900">
                            Connection Error
                          </CardTitle>
                        </motion.div>
                      </CardHeader>
                      <CardContent className="relative">
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="text-sm text-red-700 mb-4"
                        >
                          {error.message}
                        </motion.p>
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resetForm}
                            className="h-10 px-4 border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 transition-all duration-200 font-medium"
                          >
                            Try Again
                          </Button>
                        </motion.div>
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
