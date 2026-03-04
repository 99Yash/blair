import * as z from 'zod';
import { GitHub, Google } from '~/components/ui/icons';

export const GENERATED_POST_CONTENT_MAX_LENGTH = 280;
export const SCRAPED_POST_CONTENT_MAX_LENGTH = 100000;
/**
 * Maximum tone weight value (0-100 scale). Used to normalise
 * weighted-distance scoring when matching training-post tone profiles.
 */
export const TONE_WEIGHT_MAX = 100;

// ---------------------------------------------------------------------------
// Chunking defaults (CHUNK-2, CHUNK-3)
// ---------------------------------------------------------------------------

/** Default maximum characters per chunk. */
export const CHUNKING_DEFAULT_MAX_LEN = 2000;

/** Default overlap characters between adjacent chunks (~15% of max). */
export const CHUNKING_DEFAULT_OVERLAP = 300;

// ---------------------------------------------------------------------------
// Adaptive chunking (CHUNK-2) — scales chunk size with source length
// ---------------------------------------------------------------------------

/** Minimum chunk size (chars) for short documents. */
export const CHUNKING_MIN_LEN = 500;

/** Maximum chunk size (chars) for long documents. */
export const CHUNKING_MAX_LEN = 2000;

/**
 * Source length (chars) at which the adaptive scaler tops out at
 * CHUNKING_MAX_LEN. Documents shorter than this get proportionally
 * smaller chunks.
 */
export const CHUNKING_SCALE_CEIL = 80_000;

/** Overlap as a fraction of the computed chunk size (0-1). */
export const CHUNKING_OVERLAP_RATIO = 0.15;

/**
 * Ordered separators from coarsest to finest boundary.
 * The list **must** end with '' (character-level fallback) so that every
 * chunk is guaranteed to fit within the max length.
 */
export const CHUNKING_DEFAULT_SEPARATORS: string[] = [
  '\n\n',  // paragraph
  '\n',    // line
  '. ',    // sentence (with trailing space)
  '! ',
  '? ',
  ': ',
  '; ',
  ', ',
  '.',     // sentence (no trailing space)
  '!',
  '?',
  ':',
  ';',
  ',',
  ' ',     // word
  '',      // character fallback
];

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
