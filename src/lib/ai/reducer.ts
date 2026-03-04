/**
 * Chunk-level analysis reducer (CHUNK-4, CHUNK-5).
 *
 * Analyzes each content chunk independently for claims, stats, angles,
 * and quotes, then merges chunk insights into a compact "content brief"
 * used as context for final post generation.
 */

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import * as z from 'zod/v4';

import type { ContentChunk } from './chunking';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Per-chunk analysis extracted by the fast model. */
export const chunkAnalysisSchema = z.object({
  key_claims: z
    .array(z.string())
    .max(5)
    .describe('Main assertions, arguments, or takeaways in this chunk'),
  concrete_stats: z
    .array(z.string())
    .max(5)
    .describe('Specific numbers, percentages, data points, or metrics'),
  contrarian_angles: z
    .array(z.string())
    .max(3)
    .describe('Non-obvious, provocative, or counter-intuitive takes'),
  quote_worthy_lines: z
    .array(z.string())
    .max(3)
    .describe('Memorable phrases or sentences worth referencing'),
  audience_relevance: z
    .string()
    .max(200)
    .describe('Brief note on why the target audience would care about this chunk'),
});

export type ChunkAnalysis = z.infer<typeof chunkAnalysisSchema>;

/** Annotated chunk analysis with source position metadata. */
export interface AnnotatedChunkAnalysis {
  chunk_index: number;
  char_start: number;
  char_end: number;
  analysis: ChunkAnalysis;
  /** Simple density score: total number of concrete insights extracted. */
  density: number;
}

/** Compact brief produced by the reducer pass for final generation. */
export interface ContentBrief {
  /** Top claims across all chunks, deduplicated and ranked. */
  top_claims: string[];
  /** Best concrete stats/numbers. */
  key_stats: string[];
  /** Most interesting contrarian or opinionable angles. */
  best_angles: string[];
  /** Most quote-worthy lines from the source. */
  best_quotes: string[];
  /** Number of chunks analyzed. */
  chunk_count: number;
}

// ---------------------------------------------------------------------------
// Chunk analysis
// ---------------------------------------------------------------------------

const ANALYSIS_MODEL_ID = 'gemini-2.0-flash';

/** Maximum chunks to analyze (controls cost/latency). */
const MAX_CHUNKS_TO_ANALYZE = 30;

/** Concurrency limit for parallel chunk analysis. */
const ANALYSIS_CONCURRENCY = 3;

/**
 * Analyzes a single content chunk, extracting structured insights.
 */
export async function analyzeChunk(
  chunk: ContentChunk,
): Promise<AnnotatedChunkAnalysis | null> {
  const call = () =>
    generateObject({
      model: google(ANALYSIS_MODEL_ID),
      schema: chunkAnalysisSchema,
      prompt: `Extract key insights from this content chunk. Focus on concrete details, specific data, and non-obvious angles. If the chunk has no meaningful insights, return empty arrays.

Chunk (${chunk.char_start}-${chunk.char_end}):
${chunk.text}`,
    });

  try {
    const result = await call().catch(() => call());

    const analysis = result.object;
    const density =
      analysis.key_claims.length +
      analysis.concrete_stats.length +
      analysis.contrarian_angles.length +
      analysis.quote_worthy_lines.length;

    return {
      chunk_index: chunk.chunk_index,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
      analysis,
      density,
    };
  } catch (err) {
    console.warn(`Chunk ${chunk.chunk_index} analysis failed, skipping:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Runs `fn` over items with bounded concurrency.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

/**
 * Analyzes all chunks with bounded concurrency, skipping chunks beyond
 * the analysis cap.
 */
export async function analyzeChunks(
  chunks: ContentChunk[],
): Promise<AnnotatedChunkAnalysis[]> {
  const toAnalyze = chunks.slice(0, MAX_CHUNKS_TO_ANALYZE);
  const results = await mapWithConcurrency(toAnalyze, ANALYSIS_CONCURRENCY, analyzeChunk);
  return results.filter((r): r is AnnotatedChunkAnalysis => r !== null);
}

// ---------------------------------------------------------------------------
// Reducer — merge chunk analyses into a content brief
// ---------------------------------------------------------------------------

/** Deduplicate strings by lowercased content, keeping first occurrence. */
function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Merges chunk-level analyses into a compact content brief.
 *
 * Prioritizes chunks with higher density (more concrete insights)
 * and deduplicates across chunks.
 */
export function reduceToContentBrief(
  analyses: AnnotatedChunkAnalysis[],
): ContentBrief {
  // Sort by density descending so highest-signal chunks contribute first
  const sorted = [...analyses].sort((a, b) => b.density - a.density);

  const allClaims: string[] = [];
  const allStats: string[] = [];
  const allAngles: string[] = [];
  const allQuotes: string[] = [];

  for (const a of sorted) {
    allClaims.push(...a.analysis.key_claims);
    allStats.push(...a.analysis.concrete_stats);
    allAngles.push(...a.analysis.contrarian_angles);
    allQuotes.push(...a.analysis.quote_worthy_lines);
  }

  return {
    top_claims: dedup(allClaims).slice(0, 10),
    key_stats: dedup(allStats).slice(0, 8),
    best_angles: dedup(allAngles).slice(0, 5),
    best_quotes: dedup(allQuotes).slice(0, 5),
    chunk_count: analyses.length,
  };
}

// ---------------------------------------------------------------------------
// Top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Full pipeline: chunk → analyze → reduce.
 *
 * Returns the content brief and the annotated analyses for telemetry.
 */
export async function buildContentBrief(
  chunks: ContentChunk[],
): Promise<{ brief: ContentBrief; analyses: AnnotatedChunkAnalysis[] }> {
  if (chunks.length === 0) {
    return {
      brief: {
        top_claims: [],
        key_stats: [],
        best_angles: [],
        best_quotes: [],
        chunk_count: 0,
      },
      analyses: [],
    };
  }

  const analyses = await analyzeChunks(chunks);
  const brief = reduceToContentBrief(analyses);
  return { brief, analyses };
}

/**
 * Formats a content brief as a string for injection into generation prompts.
 */
export function formatContentBrief(brief: ContentBrief): string {
  const sections: string[] = [];

  if (brief.top_claims.length > 0) {
    sections.push(
      `Key claims:\n${brief.top_claims.map((c) => `  - ${c}`).join('\n')}`,
    );
  }
  if (brief.key_stats.length > 0) {
    sections.push(
      `Concrete stats/numbers:\n${brief.key_stats.map((s) => `  - ${s}`).join('\n')}`,
    );
  }
  if (brief.best_angles.length > 0) {
    sections.push(
      `Interesting angles:\n${brief.best_angles.map((a) => `  - ${a}`).join('\n')}`,
    );
  }
  if (brief.best_quotes.length > 0) {
    sections.push(
      `Quote-worthy lines:\n${brief.best_quotes.map((q) => `  - "${q}"`).join('\n')}`,
    );
  }

  return sections.join('\n\n');
}
