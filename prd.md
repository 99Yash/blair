# Blair v2 PRD - Ghostwriter-Grade Post Generation

## Why this exists

Blair can already scrape a URL and generate a post, but the output quality is not competitive yet:

- Posts read like generic marketing copy instead of a sharp human voice.
- Twitter posts can exceed platform limits.
- Training examples are polluted because scraped article content is stored as `post_content`.
- Tone controls have little practical effect.
- We truncate long pages (`slice(0, 100000)`) instead of chunking intelligently.

The goal of this PRD is to turn Blair into a high-signal ghostwriter that produces concise, opinionated, platform-safe posts with repeatable quality.

---

## Product goals

1. Generate posts that sound human, specific, and opinionated.
2. Enforce platform constraints with zero invalid outputs.
3. Build a reliable chunking + retrieval layer for long-form source content.
4. Make iteration easy (regenerate, compare variants, keep history).
5. Add measurable quality gates and offline evals.

---

## Non-goals (for this cycle)

- Full multi-account social scheduling and publishing.
- Auto-image/video generation.
- Multi-language support beyond English.
- Fully autonomous long-thread drafting.

---

## Current-state audit (from codebase)

### Critical

#### DATA-1: Training posts are stored incorrectly

- In `src/app/api/posts/train/route.ts`, `post_content` is saved from scraped markdown instead of user-authored post text.
- This contaminates few-shot examples and causes model drift toward raw article style.

#### GEN-1: Weak model choice for writing

- Generation and analysis both use `gemini-2.0-flash-lite` in `src/app/api/posts/generate/route.ts` and `src/app/api/posts/train/route.ts`.
- Lite favors speed/cost over writing quality.

#### GEN-2: Prompt framing encourages bland output

- Prompt persona in `src/app/api/posts/generate/route.ts` is "professional social media copywriter", producing generic corporate copy.

#### PLAT-1: No hard output validator

- Platform limits are advisory only; output is streamed and stored without hard validation.

### High

#### CHUNK-1: No real chunking strategy

- Current behavior slices content to `100000` chars and analyzes once.
- Long documents lose structure and important middle/end sections.

#### RET-1: Retrieval quality is shallow

- Tone similarity SQL is brittle (`TONE_WEIGHT_SIMILARITY_THRESHOLD = 0.15` against 0-100 weights).
- Embeddings are generated for training posts but not used in generation retrieval.

#### ITER-1: Regeneration blocked by unique constraint

- `generate_posts` enforces unique `(user_id, original_url)` in `src/db/schemas/generate-post.ts`, preventing iterative drafting.

#### UX-1: Broken analyze button in training form

- `src/components/forms/post-form.tsx` calls `/api/posts`, but that route does not exist.

### Medium

#### QUAL-1: No quality scoring or evaluator

- There is no automatic quality rubric before saving output.

#### OBS-1: Limited instrumentation

- No structured metrics for pass/fail by platform, regen counts, or phrase-level anti-pattern incidence.

---

## Chunking requirements (inspired by milkpod)

Reference patterns from:

- `../milkpod/packages/ai/src/embeddings.ts` (`chunkSegmentText`, recursive separator fallback)
- `../milkpod/packages/api/src/modules/moments/chunking.ts` (adaptive chunk size + overlap)
- `../milkpod/packages/api/src/modules/moments/chunking.test.ts` (edge-case tests)

### CHUNK-2: Adaptive chunk configuration

- Chunk size should scale with source length, not be fixed.
- Initial target:
  - Min chunk: 500 chars
  - Max chunk: 2000 chars
  - Overlap: ~15%

### CHUNK-3: Recursive boundary-aware splitting

- Split using decreasing separators: paragraph -> line -> sentence -> punctuation -> space -> char fallback.
- Ensure no chunk exceeds max length.

### CHUNK-4: Metadata-preserving chunks

Each chunk must include:

- `chunk_id`
- `source_url`
- `char_start`, `char_end`
- optional heading/context label
- chunk text

### CHUNK-5: Chunk-level understanding pass

For each chunk, extract:

- key claims
- concrete numbers/stats
- contrarian/opinionable angles
- audience relevance
- quote-worthy lines

Then run a reducer pass to build a compact "content brief" used for final generation.

### CHUNK-6: Chunking test suite

Add tests for:

- empty input
- tiny input
- very long no-punctuation input
- overlap correctness
- deterministic output
- heading/paragraph boundary retention

---

## Product requirements

### Data and corpus quality

#### DATA-2: Correct training storage model

- `training_posts.post_content` must store actual social post text.
- Scraped source article text must be stored separately (`source_content_raw` or chunk table).

#### DATA-3: Add training quality constraints

- Reject training entries that are clearly article dumps.
- Require platform-valid post length per platform.

#### DATA-4: Version generated drafts

- Support multiple drafts per URL and user.
- Keep metadata to compare quality across versions.

### Retrieval and context building

#### RET-2: Hybrid retrieval

- Rank candidate training examples using:
  - platform/content-type filters
  - tone similarity (fixed to 0-100 scale)
  - embedding similarity
  - recency/diversity boost

#### RET-3: De-duplicate and diversify examples

- Avoid near-duplicate examples in final few-shot set.
- Prefer style diversity while preserving target tone.

### Generation quality

#### GEN-3: Model routing by task

- Fast model for extraction/analysis.
- Stronger model for writing and rewrite passes.

#### GEN-4: Anti-slop writing spec

- Explicitly ban generic patterns:
  - "Unlock the power"
  - "Dive in"
  - "Discover"
  - "Elevate"
  - empty CTA filler
  - hashtag spam

#### GEN-5: Multi-candidate + judge pass

- Generate 3-5 candidates.
- Rank via rubric (specificity, originality, voice, platform fit).
- Return best + 1 alternative.

#### GEN-6: Voice memory

- Track accepted outputs and edits to infer per-user voice profile.
- Use this profile to steer future drafts.

### Platform safety and compliance

#### PLAT-2: Hard validator before save

- Validate character limits (including Twitter URL counting behavior).
- Validate emoji and hashtag caps.
- Validate banned-pattern score.

#### PLAT-3: Auto-rewrite loop

- If invalid, rewrite with constraints and retry up to N attempts.
- Never save invalid output.

### User workflow

#### UX-2: Regenerate and compare

- Add "Regenerate" without changing URL.
- Show side-by-side variants or version list.

#### UX-3: Explainability panel

- Show extracted key points used to generate the post.
- Show why final variant won (rubric subscores).

#### UX-4: Fast controls

- Add controls for:
  - edginess
  - brevity
  - CTA strength
  - hashtag aggressiveness

### Reliability and observability

#### OBS-2: Structured generation telemetry

- Track per request:
  - model used
  - chunk count
  - validator failures
  - rewrite count
  - final char count
  - latency + token usage

#### QUAL-2: Offline eval harness

- Keep a fixed benchmark set of URLs and expected quality properties.
- Score each release before rollout.

---

## Success metrics

### Quality metrics

- >= 90% of outputs pass human review for "would post as-is".
- <= 5% outputs contain banned generic phrases.
- >= 80% of outputs include at least one concrete detail (number, mechanism, tradeoff).

### Compliance metrics

- 100% Twitter outputs <= 280 characters at save time.
- 0 invalid posts stored in database.

### UX metrics

- Regeneration usage >= 40% of sessions (healthy drafting loop).
- Time-to-acceptable-draft reduced by >= 30%.

### System metrics

- P95 generation latency <= 12s for first valid draft.
- Retry loop failure rate <= 1%.

---

## Release strategy

1. Ship chunking + data integrity fixes first.
2. Add validator and rewrite loop second.
3. Ship multi-candidate judge pass behind feature flag.
4. Enable voice memory after enough accepted samples exist.

---

## Risks and mitigations

- **Cost increase from stronger models** -> route only writing pass to premium model; keep analysis cheap.
- **Latency increase from multi-pass flow** -> bounded chunk counts, concurrency, and early-stop on high-confidence draft.
- **Overfitting to anti-pattern bans** -> include positive style rubric, not only bans.
- **Migration complexity** -> stage schema changes with backward-compatible reads first.
