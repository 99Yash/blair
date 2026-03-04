# Baseline Quality Scores (Pre-v2)

Snapshot date: 2026-03-04
Source: `GENERATED_EXAMPLES.md` analysis of 33 generated posts + 3 training posts.

---

## Summary

| Metric | Baseline | Target (PRD) |
|--------|----------|---------------|
| Posts passing "would post as-is" human review | ~0% | >= 90% |
| Posts with banned generic phrases | ~85% | <= 5% |
| Posts with at least one concrete detail | ~15% | >= 80% |
| Twitter posts within 280 chars | ~30% | 100% |
| Invalid posts stored in DB | High | 0 |

---

## Dimension Scores (manual review of sample posts)

Scored on 1-5 scale. Sample of 7 representative posts from GENERATED_EXAMPLES.md.

| Post | Specificity | Originality | Voice | Platform Compliance | Overall |
|------|-------------|-------------|-------|---------------------|---------|
| PostgreSQL EXPLAIN | 2 | 2 | 1 | 4 | 2.25 |
| Biome lint rule | 1 | 1 | 1 | 3 | 1.50 |
| Stripe Ledger | 3 | 1 | 1 | 3 | 2.00 |
| Bloom Filters | 3 | 2 | 1 | 3 | 2.25 |
| v0 Ambassador | 1 | 2 | 1 | 1 | 1.25 |
| Anthropic tools | 1 | 1 | 1 | 3 | 1.50 |
| Postgres indexes | 2 | 1 | 1 | 3 | 1.75 |
| **Mean** | **1.86** | **1.43** | **1.00** | **2.86** | **1.79** |

---

## Observed Anti-Patterns

Frequency across the 33-post corpus:

| Pattern | Occurrences | % of posts |
|---------|-------------|------------|
| "Unlock the power" / "Unlock ..." | ~8 | ~24% |
| "Dive in" / "Dive into" | ~6 | ~18% |
| "Discover" | ~5 | ~15% |
| "Elevate" / "Empower" | ~4 | ~12% |
| "Exciting news" | ~3 | ~9% |
| Excessive emojis (4+) | ~6 | ~18% |
| Excessive hashtags (4+) | ~5 | ~15% |
| Twitter posts > 280 chars | ~23 | ~70% |

---

## Root Causes

1. **Model**: `gemini-2.0-flash-lite` is optimized for speed, not creative writing.
2. **Prompt**: "Professional social media copywriter" persona produces corporate copy.
3. **Training data**: `post_content` stores scraped articles, not actual posts.
4. **No validation**: Character limits are advisory only; no hard reject + retry.
5. **Tone irrelevance**: Tone weights have minimal impact on Flash Lite output.

---

## Eval Infrastructure

- **Eval URL set**: `scripts/evals/eval-urls.json` — 52 URLs across 7 content types and 13 topics.
- **Rubric definition**: `scripts/evals/rubric.ts` — 4 dimensions, scoring 1-5.
- **Eval runner**: `scripts/evals/run-eval.ts` — deterministic checks (banned phrases, platform limits) + human review scaffold.

---

## How to Re-benchmark

1. Generate posts for all eval URLs using the current pipeline.
2. Export results as JSONL (one `{url, platform, content_type, generated_post}` per line).
3. Run: `npx tsx scripts/evals/run-eval.ts --input results.jsonl`
4. Compare `scored-results.json` summary against these baseline numbers.
