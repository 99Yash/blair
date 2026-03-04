/**
 * Quality rubric for Blair post generation evaluation.
 *
 * Each dimension is scored 1-5. The rubric is used by both automated
 * (LLM-as-judge) and manual human review passes.
 */

// ---------------------------------------------------------------------------
// Rubric dimensions
// ---------------------------------------------------------------------------

export interface RubricScore {
  /** Concrete facts, numbers, mechanisms, or tradeoffs present in the post. */
  specificity: number;
  /** Does not read like template output; avoids banned generic phrases. */
  originality: number;
  /** Sounds like a real person with an opinion, not a press release. */
  voice: number;
  /** Meets platform character limits, hashtag caps, and formatting norms. */
  platform_compliance: number;
}

export type RubricDimension = keyof RubricScore;

export const RUBRIC_DIMENSIONS: Record<
  RubricDimension,
  { label: string; description: string; anchor_low: string; anchor_high: string }
> = {
  specificity: {
    label: 'Specificity',
    description:
      'Post references concrete details from the source: numbers, benchmarks, mechanisms, tradeoffs, or named entities.',
    anchor_low: 'Vague platitudes only ("unlock the power", "boost performance").',
    anchor_high:
      'Contains at least one concrete stat, named mechanism, or specific tradeoff pulled from the source.',
  },
  originality: {
    label: 'Originality',
    description:
      'Post avoids generic AI-copy patterns and banned phrases. Phrasing feels fresh, not templated.',
    anchor_low:
      'Uses multiple banned phrases (Discover, Unlock, Dive in, Elevate) and follows the opener-buzzword-URL-hashtag template.',
    anchor_high:
      'Zero banned phrases. Structure and word choice feel unpredictable and human-written.',
  },
  voice: {
    label: 'Voice',
    description:
      'Post has a clear point of view. The author sounds opinionated, not neutral or corporate.',
    anchor_low:
      'Reads like a press release or generic marketing copy. No opinion, no edge.',
    anchor_high:
      'Clear opinion or take. Reader can infer what the author actually thinks about the topic.',
  },
  platform_compliance: {
    label: 'Platform Compliance',
    description:
      'Post respects hard platform constraints: character limits, hashtag caps, emoji density, and formatting norms.',
    anchor_low:
      'Exceeds character limit, excessive hashtags or emojis, wrong formatting for the platform.',
    anchor_high:
      'Within all limits, appropriate hashtag and emoji usage, good formatting for the platform.',
  },
};

// ---------------------------------------------------------------------------
// Banned phrases (GEN-4 anti-slop)
// ---------------------------------------------------------------------------

export const BANNED_PHRASES = [
  'unlock the power',
  'dive in',
  'dive into',
  'discover how',
  'discover the',
  'elevate your',
  'supercharge your',
  'revolutionize',
  'game-changer',
  'game changer',
  'unleash',
  'harness the power',
  'take your .* to the next level',
  'empower your',
  'boost your',
  'exciting news',
  'check it out',
  'read more',
  '#ReadArticle',
] as const;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

/** Threshold for "acceptable" — a post humans would publish as-is. */
export const ACCEPTABLE_THRESHOLD = 3.5;

/** Compute overall quality score as unweighted mean of dimensions. */
export function overallScore(scores: RubricScore): number {
  const dims = Object.values(scores);
  return dims.reduce((sum, s) => sum + s, 0) / dims.length;
}

/** Check if any banned phrase appears (case-insensitive). */
export function containsBannedPhrase(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => {
    if (phrase.includes('.*')) {
      return new RegExp(phrase, 'i').test(text);
    }
    return lower.includes(phrase.toLowerCase());
  });
}

// ---------------------------------------------------------------------------
// Platform limits (from src/lib/constants.tsx PLATFORM_GENERATION_CONFIG)
// ---------------------------------------------------------------------------

export const PLATFORM_LIMITS: Record<string, { max_chars: number; max_hashtags: number }> = {
  twitter: { max_chars: 280, max_hashtags: 2 },
  linkedin: { max_chars: 3000, max_hashtags: 5 },
  instagram: { max_chars: 2200, max_hashtags: 30 },
  facebook: { max_chars: 63206, max_hashtags: 3 },
};

// ---------------------------------------------------------------------------
// Eval result types
// ---------------------------------------------------------------------------

export interface EvalResult {
  url: string;
  platform: string;
  content_type: string;
  generated_post: string;
  char_count: number;
  scores: RubricScore;
  overall: number;
  banned_phrases_found: string[];
  platform_valid: boolean;
  timestamp: string;
}

export interface EvalSummary {
  total: number;
  mean_overall: number;
  mean_by_dimension: RubricScore;
  pct_acceptable: number;
  pct_banned_phrase_free: number;
  pct_platform_valid: number;
  timestamp: string;
}

export function summarizeResults(results: EvalResult[]): EvalSummary {
  const n = results.length;
  if (n === 0) {
    return {
      total: 0,
      mean_overall: 0,
      mean_by_dimension: { specificity: 0, originality: 0, voice: 0, platform_compliance: 0 },
      pct_acceptable: 0,
      pct_banned_phrase_free: 0,
      pct_platform_valid: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const sum: RubricScore = { specificity: 0, originality: 0, voice: 0, platform_compliance: 0 };
  let totalOverall = 0;
  let acceptable = 0;
  let bannedPhraseFree = 0;
  let platformValid = 0;

  for (const r of results) {
    sum.specificity += r.scores.specificity;
    sum.originality += r.scores.originality;
    sum.voice += r.scores.voice;
    sum.platform_compliance += r.scores.platform_compliance;
    totalOverall += r.overall;
    if (r.overall >= ACCEPTABLE_THRESHOLD) acceptable++;
    if (r.banned_phrases_found.length === 0) bannedPhraseFree++;
    if (r.platform_valid) platformValid++;
  }

  return {
    total: n,
    mean_overall: +(totalOverall / n).toFixed(2),
    mean_by_dimension: {
      specificity: +(sum.specificity / n).toFixed(2),
      originality: +(sum.originality / n).toFixed(2),
      voice: +(sum.voice / n).toFixed(2),
      platform_compliance: +(sum.platform_compliance / n).toFixed(2),
    },
    pct_acceptable: +((acceptable / n) * 100).toFixed(1),
    pct_banned_phrase_free: +((bannedPhraseFree / n) * 100).toFixed(1),
    pct_platform_valid: +((platformValid / n) * 100).toFixed(1),
    timestamp: new Date().toISOString(),
  };
}
