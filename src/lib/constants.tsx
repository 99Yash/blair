import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  Clock,
  Copy,
  Flag,
  Flame,
  Minus,
  XCircle,
} from 'lucide-react';
import * as z from 'zod';
import { GitHub, Google } from '~/components/ui/icons';

export const GENERATED_POST_CONTENT_MAX_LENGTH = 280;
export const SCRAPED_POST_CONTENT_MAX_LENGTH = 100000;
export const TONE_WEIGHT_SIMILARITY_THRESHOLD = 80;

// Platform-specific content generation guidelines
export const PLATFORM_GENERATION_CONFIG = {
  twitter: {
    characterLimit: 280,
    bestPractices: [
      'Keep posts concise and impactful',
      'Front-load key information in the first line',
      'Use line breaks for readability (max 3-4 lines)',
      'Avoid emojis unless specifically requested',
      'Hashtags should be minimal and relevant (0-2 maximum)',
      'Thread-style formatting is acceptable for complex ideas',
      'Questions and hooks work well for engagement',
    ],
    formatting: {
      preferredLength: '100-240 characters',
      hashtagPlacement: 'end of post or naturally integrated',
      urlHandling: 'URLs count as 23 characters regardless of length',
    },
  },
  linkedin: {
    characterLimit: 3000,
    bestPractices: [
      'Start with a compelling hook or question',
      'Use professional but conversational tone',
      'Break content into short paragraphs (2-3 sentences max)',
      'Include a clear call-to-action',
      'Avoid excessive emojis; use sparingly if at all',
      'Data, insights, and personal experiences perform well',
      'Consider using the "see more" preview strategically',
      'Tag relevant companies or people when appropriate',
    ],
    formatting: {
      preferredLength: '150-300 words for optimal engagement',
      hashtagPlacement: 'end of post (3-5 relevant hashtags)',
      urlHandling: 'Link previews auto-generate; consider placement',
    },
  },
  instagram: {
    characterLimit: 2200,
    bestPractices: [
      'First line is critical for grabbing attention',
      'Use line breaks and spacing for visual appeal',
      'Emojis can be used more liberally than other platforms',
      'Storytelling and authenticity drive engagement',
      'Include a clear call-to-action',
      'Consider the caption as complementary to visual content',
      'Ask questions to encourage comments',
    ],
    formatting: {
      preferredLength: '138-150 characters or 500+ for deeper stories',
      hashtagPlacement: 'end of post or first comment (10-30 hashtags)',
      urlHandling: 'Links are not clickable; use bio link or stories',
    },
  },
  facebook: {
    characterLimit: 63206,
    bestPractices: [
      'Keep posts concise despite high character limit (40-80 characters perform best)',
      'Questions and fill-in-the-blank posts drive engagement',
      'Use conversational, friendly tone',
      'Avoid emojis unless specifically requested',
      'Consider your audience demographics (typically older)',
      'Link posts should have compelling preview text',
      'Native content performs better than external links',
    ],
    formatting: {
      preferredLength: '40-80 characters for optimal engagement',
      hashtagPlacement: 'minimal usage; 1-3 hashtags maximum',
      urlHandling:
        'Link previews auto-generate; remove URL after preview loads',
    },
  },
} as const;

export type Platform = keyof typeof PLATFORM_GENERATION_CONFIG;

export const authOptionsSchema = z.enum(['EMAIL', 'GOOGLE', 'GITHUB']);
export type AuthOptionsType = z.infer<typeof authOptionsSchema>;

export const LOCAL_STORAGE_SCHEMAS = {
  LAST_AUTH_METHOD: authOptionsSchema,
} as const;

export const ISSUE_STATUS_OPTIONS = [
  {
    value: 'backlog',
    label: 'Backlog',
    color: 'bg-status-backlog',
    icon: CircleDashed,
    textColor: 'text-status-backlog',
  },
  {
    value: 'todo',
    label: 'Todo',
    color: 'bg-status-todo',
    icon: Circle,
    textColor: 'text-status-todo',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    color: 'bg-status-in-progress',
    icon: Clock,
    textColor: 'text-status-in-progress',
  },
  {
    value: 'in_review',
    label: 'In Review',
    color: 'bg-status-in-review',
    icon: CircleDot,
    textColor: 'text-status-in-review',
  },
  {
    value: 'done',
    label: 'Done',
    color: 'bg-status-done',
    icon: CheckCircle2,
    textColor: 'text-status-done',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'bg-status-cancelled',
    icon: XCircle,
    textColor: 'text-status-cancelled',
  },
  {
    value: 'duplicate',
    label: 'Duplicate',
    color: 'bg-status-duplicate',
    icon: Copy,
    textColor: 'text-status-duplicate',
  },
] as const;

export const ISSUE_PRIORITY_OPTIONS = [
  {
    value: 'no_priority',
    label: 'No priority',
    color: 'bg-muted-foreground/60',
    icon: Flag,
    textColor: 'text-priority-none',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    color: 'bg-red-600',
    icon: Flame,
    textColor: 'text-priority-urgent',
  },
  {
    value: 'high',
    label: 'High',
    color: 'bg-orange-500',
    icon: ArrowUp,
    textColor: 'text-priority-high',
  },
  {
    value: 'medium',
    label: 'Medium',
    color: 'bg-yellow-400',
    icon: Minus,
    textColor: 'text-priority-medium',
  },
  {
    value: 'low',
    label: 'Low',
    color: 'bg-green-500',
    icon: ArrowDown,
    textColor: 'text-priority-low',
  },
] as const;

export type IssueStatus = (typeof ISSUE_STATUS_OPTIONS)[number]['value'];
export type IssuePriority = (typeof ISSUE_PRIORITY_OPTIONS)[number]['value'];

export type LocalStorageKey = keyof typeof LOCAL_STORAGE_SCHEMAS;

export type LocalStorageValue<K extends LocalStorageKey> = z.infer<
  (typeof LOCAL_STORAGE_SCHEMAS)[K] & z.ZodTypeAny
>;

interface OAuthProvider {
  id: string;
  name: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const OAUTH_PROVIDERS: Record<
  Lowercase<Exclude<AuthOptionsType, 'EMAIL'>>,
  OAuthProvider
> = {
  github: {
    id: 'github',
    name: 'GitHub',
    icon: GitHub,
  },
  google: {
    id: 'google',
    name: 'Google',
    icon: Google,
  },
} as const;

export type OAuthProviderId = keyof typeof OAUTH_PROVIDERS;

export const getProviderById = (
  id: OAuthProviderId
): OAuthProvider | undefined => {
  return OAUTH_PROVIDERS[id];
};
