/**
 * Blair eval runner.
 *
 * Scores generated posts against the quality rubric. Supports two modes:
 *
 * 1. **Manual review** (default): reads generated posts from a JSONL file and
 *    runs deterministic checks (banned phrases, platform limits). Human
 *    reviewers fill in subjective dimension scores.
 *
 * 2. **LLM-as-judge** (--judge): uses an LLM to score each post on all four
 *    rubric dimensions. Requires GOOGLE_GENERATIVE_AI_API_KEY env var.
 *
 * Usage:
 *   npx tsx scripts/evals/run-eval.ts --input results.jsonl
 *   npx tsx scripts/evals/run-eval.ts --input results.jsonl --judge
 *   npx tsx scripts/evals/run-eval.ts --input results.jsonl --output scored.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import {
  containsBannedPhrase,
  overallScore,
  PLATFORM_LIMITS,
  summarizeResults,
  type EvalResult,
  type RubricScore,
} from './rubric';

// ---------------------------------------------------------------------------
// CLI arg parsing (minimal, no deps)
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

// ---------------------------------------------------------------------------
// Input format: one JSON object per line
// { url, platform, content_type, generated_post }
// ---------------------------------------------------------------------------

interface RawEntry {
  url: string;
  platform: string;
  content_type: string;
  generated_post: string;
}

function loadEntries(path: string): RawEntry[] {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const lines = readFileSync(abs, 'utf-8')
    .split('\n')
    .filter((l) => l.trim());
  return lines.map((l, i) => {
    try {
      return JSON.parse(l) as RawEntry;
    } catch {
      console.error(`Invalid JSON on line ${i + 1}`);
      process.exit(1);
    }
  });
}

// ---------------------------------------------------------------------------
// Deterministic scoring helpers
// ---------------------------------------------------------------------------

function scorePlatformCompliance(post: string, platform: string): { valid: boolean; score: number } {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return { valid: true, score: 3 };

  const charCount = post.length;
  const hashtags = (post.match(/#\w+/g) || []).length;

  const charOk = charCount <= limits.max_chars;
  const hashtagOk = hashtags <= limits.max_hashtags;

  if (charOk && hashtagOk) return { valid: true, score: 5 };
  if (charOk && !hashtagOk) return { valid: false, score: 3 };
  if (!charOk && hashtagOk) return { valid: false, score: 2 };
  return { valid: false, score: 1 };
}

// ---------------------------------------------------------------------------
// Deterministic-only scoring (no LLM)
// ---------------------------------------------------------------------------

function scoreEntry(entry: RawEntry): EvalResult {
  const banned = containsBannedPhrase(entry.generated_post);
  const { valid, score: complianceScore } = scorePlatformCompliance(
    entry.generated_post,
    entry.platform
  );

  // Heuristic originality: penalize banned phrases
  const originalityScore = Math.max(1, 5 - banned.length * 1.5);

  // Specificity and voice cannot be scored deterministically — default to 0
  // and mark as needing human review.
  const scores: RubricScore = {
    specificity: 0,
    originality: +originalityScore.toFixed(1),
    voice: 0,
    platform_compliance: complianceScore,
  };

  return {
    url: entry.url,
    platform: entry.platform,
    content_type: entry.content_type,
    generated_post: entry.generated_post,
    char_count: entry.generated_post.length,
    scores,
    overall: overallScore(scores),
    banned_phrases_found: [...banned],
    platform_valid: valid,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inputPath = arg('input');
  const outputPath = arg('output') ?? 'scripts/evals/scored-results.json';

  if (!inputPath) {
    console.log('Usage: npx tsx scripts/evals/run-eval.ts --input <results.jsonl> [--output <path>]');
    console.log('');
    console.log('Input JSONL format (one per line):');
    console.log('  {"url":"...","platform":"twitter","content_type":"tech_tutorial","generated_post":"..."}');
    console.log('');
    console.log('Options:');
    console.log('  --input   Path to JSONL file of generated posts');
    console.log('  --output  Path for scored results JSON (default: scripts/evals/scored-results.json)');
    console.log('  --judge   Use LLM-as-judge for subjective dimensions (not yet implemented)');
    process.exit(0);
  }

  if (hasFlag('judge')) {
    console.log('LLM-as-judge mode is planned for Phase 4 (Task 16). Using deterministic scoring.');
  }

  const entries = loadEntries(inputPath);
  console.log(`Loaded ${entries.length} entries from ${inputPath}`);

  const results = entries.map(scoreEntry);
  const summary = summarizeResults(results);

  const output = { summary, results };
  const absOutput = resolve(outputPath);
  writeFileSync(absOutput, JSON.stringify(output, null, 2));
  console.log(`Scored results written to ${absOutput}`);

  // Print summary
  console.log('\n--- Eval Summary ---');
  console.log(`Total evaluated:         ${summary.total}`);
  console.log(`Mean overall score:      ${summary.mean_overall} / 5`);
  console.log(`  Specificity:           ${summary.mean_by_dimension.specificity}`);
  console.log(`  Originality:           ${summary.mean_by_dimension.originality}`);
  console.log(`  Voice:                 ${summary.mean_by_dimension.voice}`);
  console.log(`  Platform compliance:   ${summary.mean_by_dimension.platform_compliance}`);
  console.log(`% acceptable (>= 3.5):   ${summary.pct_acceptable}%`);
  console.log(`% banned-phrase free:    ${summary.pct_banned_phrase_free}%`);
  console.log(`% platform valid:        ${summary.pct_platform_valid}%`);
}

main();
