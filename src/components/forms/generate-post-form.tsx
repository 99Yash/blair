'use client';

import { useChat } from '@ai-sdk/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, easeOut, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod/v4';

import { DefaultChatTransport } from 'ai';
import { AlertCircle, CheckCircle, Clock, Info, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Badge } from '~/components/ui/badge';
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
import {
  StreamingDataMap,
  type StreamingPostMessage,
} from '~/lib/types/streaming';

// ToneSelector component for selecting tones and weights
interface ToneSelectorProps {
  value: Array<{ tone: string; weight: number }>;
  onChange: (value: Array<{ tone: string; weight: number }>) => void;
}

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
      <div className="space-y-2">
        <label className="text-sm font-medium">Tone Profile</label>
        <p className="text-xs text-muted-foreground">
          Select tones and assign weights (total should not exceed 100)
        </p>
      </div>

      {/* Selected tones */}
      <div className="space-y-3">
        {value.map((tone) => (
          <div
            key={tone.tone}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-sm">
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
                className="w-16 h-8 text-xs"
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
          <div className="grid grid-cols-2 gap-2">
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
                  className="h-auto p-3 text-left justify-start"
                >
                  <div>
                    <div className="font-medium text-sm">{tone.label}</div>
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
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="text-sm">
          <span className="font-medium">Total Weight:</span> {totalWeight}/100
        </div>
        <div
          className={`text-xs ${
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

// Dynamically import LLMOutput to avoid SSR issues with Shiki
const LLMOutput = dynamic(
  () =>
    import('~/components/ui/llm-output').then((mod) => ({
      default: mod.LLMOutput,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground animate-pulse">
        Loading renderer...
      </div>
    ),
  }
);

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
  // Only keep transient notifications in state (not persisted in message parts)
  const [notifications, setNotifications] = useState<
    StreamingDataMap['notification'][]
  >([]);

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
          setNotifications((prev) => [...prev, dataPart.data]);
        }
      },
      onError: (error) => {
        console.error('Chat error:', error);
      },
    });

  const isSubmitting = status === 'submitted' || status === 'streaming';

  // Derive data from message parts instead of separate state
  const lastMessage = messages[messages.length - 1];
  const currentProgress = lastMessage?.parts.find(
    (part) => part.type === 'data-progress'
  )?.data;
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

  const form = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostFormSchema),
    defaultValues: {
      original_url: '',
      platform: 'twitter',
      link_ownership_type: 'third_party_content',
      tone_profile: [
        { tone: 'professional', weight: 60 },
        { tone: 'casual', weight: 40 },
      ],
    },
  });

  const resetForm = () => {
    form.reset({
      original_url: '',
      platform: 'twitter',
      link_ownership_type: 'third_party_content',
      tone_profile: [
        { tone: 'professional', weight: 60 },
        { tone: 'casual', weight: 40 },
      ],
    });
    clearError();
    setNotifications([]);
  };

  const onSubmit = async (data: CreatePostFormData) => {
    // Clear transient notifications
    setNotifications([]);
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

  const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  };

  return (
    <div className={className}>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:max-h-[calc(100vh-12rem)] overflow-y-auto">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Post Details</CardTitle>
            <CardDescription className="text-sm">
              AI will analyze your content and infer the optimal settings
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="original_url"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium">
                        URL *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/article"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        The URL you want to create a social media post about
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium">
                        Platform *
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-9">
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="link_ownership_type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-sm font-medium">
                          Content Ownership *
                        </FormLabel>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm ${
                              !field.value ||
                              field.value === 'third_party_content'
                                ? 'text-muted-foreground'
                                : 'text-foreground'
                            }`}
                          >
                            Third Party
                          </span>
                          <Switch
                            checked={field.value === 'own_content'}
                            onCheckedChange={(checked) => {
                              field.onChange(
                                checked ? 'own_content' : 'third_party_content'
                              );
                            }}
                          />
                          <span
                            className={`text-sm ${
                              field.value === 'own_content'
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            My Own
                          </span>
                        </div>
                      </div>
                      <FormDescription className="text-xs">
                        Toggle to indicate whether this is your own content or
                        third-party content
                      </FormDescription>
                      <FormMessage />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t border-border/50">
                  <Button
                    type="submit"
                    className="w-full h-10"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Post...
                      </>
                    ) : (
                      'Generate Social Media Post'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Progress and Notifications */}
          {(isSubmitting ||
            (currentProgress && !generatedPost) ||
            (notifications.length > 0 && !generatedPost)) && (
            <motion.div
              layout
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fadeIn}
            >
              <Card className="md:max-h-[calc(100vh-12rem)] overflow-y-auto">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base">
                      Generation Progress
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground">
                    Real-time updates on your post generation
                  </CardDescription>

                  {/* Subtle indeterminate progress bar during loading */}
                  {(isSubmitting || currentProgress?.status === 'loading') &&
                    !generatedPost && (
                      <div
                        className="mt-3 relative h-1 rounded bg-muted overflow-hidden"
                        aria-hidden="true"
                      >
                        <motion.div
                          className="absolute inset-y-0 left-0 w-1/3 bg-primary"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{
                            repeat: Number.POSITIVE_INFINITY,
                            duration: 1.2,
                            ease: easeOut,
                          }}
                        />
                      </div>
                    )}
                </CardHeader>

                <CardContent className="space-y-3 pt-2">
                  {/* Current Progress */}
                  <AnimatePresence mode="popLayout">
                    {currentProgress && (
                      <motion.div
                        key={`${currentProgress.stage}-${currentProgress.status}`}
                        layout
                        initial={fadeInUp.initial}
                        animate={fadeInUp.animate}
                        exit={fadeInUp.exit}
                        transition={fadeInUp.transition}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                        role="status"
                        aria-live="polite"
                      >
                        {currentProgress.status === 'loading' && (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              repeat: Number.POSITIVE_INFINITY,
                              repeatType: 'mirror',
                              duration: 0.8,
                            }}
                          >
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          </motion.div>
                        )}
                        {currentProgress.status === 'success' && (
                          <motion.div
                            initial={{ scale: 0.8, rotate: -10, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 20,
                            }}
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </motion.div>
                        )}
                        {currentProgress.status === 'error' && (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0.8 }}
                            animate={{ scale: 1, opacity: 1 }}
                          >
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          </motion.div>
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {currentProgress.message}
                          </div>
                          {currentProgress.details && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {currentProgress.details}
                            </div>
                          )}
                        </div>
                        <motion.div layout>
                          <Badge
                            variant={
                              currentProgress.status === 'loading'
                                ? 'secondary'
                                : currentProgress.status === 'success'
                                ? 'default'
                                : 'destructive'
                            }
                            className="text-xs"
                          >
                            {currentProgress.stage}
                          </Badge>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Notifications */}
                  {notifications.length > 0 && (
                    <div className="space-y-1.5">
                      <AnimatePresence initial={false}>
                        {notifications.map((notification, index) => (
                          <motion.div
                            key={`${notification.message}-${index}`}
                            layout
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{
                              type: 'spring',
                              stiffness: 300,
                              damping: 24,
                            }}
                            className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                              notification.level === 'error'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : notification.level === 'warning'
                                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                : notification.level === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                            role="status"
                            aria-live="polite"
                          >
                            <Info className="w-3 h-3" />
                            {notification.message}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Content Analysis Results */}
                  <AnimatePresence>
                    {contentAnalysis && (
                      <motion.div
                        key="content-analysis"
                        layout
                        initial={fadeInUp.initial}
                        animate={fadeInUp.animate}
                        exit={fadeInUp.exit}
                        transition={fadeInUp.transition}
                        className="p-3 bg-blue-50/80 rounded-lg border border-blue-200/60"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <motion.div
                            className="w-2 h-2 bg-blue-500 rounded-full"
                            initial={{ scale: 0.6, opacity: 0.6 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 260,
                              damping: 20,
                            }}
                          />
                          <span className="font-medium text-blue-900 text-sm">
                            Content Analyzed
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-700">Type:</span>
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5 h-5"
                            >
                              {contentAnalysis.content_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-blue-700">Audience:</span>
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0.5 h-5"
                            >
                              {contentAnalysis.target_audience}
                            </Badge>
                          </div>
                          {contentAnalysis.call_to_action_type && (
                            <div className="flex items-center gap-1 col-span-2">
                              <span className="text-blue-700">CTA:</span>
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0.5 h-5"
                              >
                                {contentAnalysis.call_to_action_type}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Training Posts Results */}
                  <AnimatePresence>
                    {trainingPosts && (
                      <motion.div
                        key="training-posts"
                        layout
                        initial={fadeInUp.initial}
                        animate={fadeInUp.animate}
                        exit={fadeInUp.exit}
                        transition={fadeInUp.transition}
                        className="p-3 bg-purple-50/80 rounded-lg border border-purple-200/60"
                      >
                        <div className="flex items-center gap-2">
                          <motion.div
                            className="w-2 h-2 bg-purple-500 rounded-full"
                            initial={{ scale: 0.6, opacity: 0.6 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 260,
                              damping: 20,
                            }}
                          />
                          <span className="font-medium text-purple-900 text-sm">
                            Found {trainingPosts.count} Similar Posts
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {error && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <CardTitle className="text-destructive text-base">
                    Error
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-destructive text-sm">{error.message}</p>
              </CardContent>
            </Card>
          )}

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
                <Card className="md:max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <CardTitle className="text-lg">Post Generated</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      Ready to share on {generatedPost.platform}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <LLMOutput
                        output={generatedPost.content}
                        isStreamFinished={
                          status !== 'streaming' && status !== 'submitted'
                        }
                        className="text-sm leading-relaxed"
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 bg-transparent"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPost.content);
                          toast.success('Copied to clipboard');
                        }}
                      >
                        Copy to Clipboard
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 bg-transparent"
                        onClick={resetForm}
                      >
                        Create Another
                      </Button>
                      <Button size="sm" className="h-8">
                        Post to {generatedPost.platform}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
