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

export const POST_CONTENT_MAX_LENGTH = 2000;
export const TONE_WEIGHT_SIMILARITY_THRESHOLD = 80;

export const authOptionsSchema = z.enum(['EMAIL', 'GOOGLE', 'GITHUB']);
export type AuthOptionsType = z.infer<typeof authOptionsSchema>;

export const LOCAL_STORAGE_SCHEMAS = {
  LAST_AUTH_METHOD: authOptionsSchema,
} as const;

export const SESSION_STORAGE_SCHEMAS = {
  SHOW_USERNAME_MODAL: z.boolean().default(false),
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

export type SessionStorageKey = keyof typeof SESSION_STORAGE_SCHEMAS;

export type SessionStorageValue<K extends SessionStorageKey> = z.infer<
  (typeof SESSION_STORAGE_SCHEMAS)[K] & z.ZodTypeAny
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
