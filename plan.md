# Blair v2 Execution Plan

This plan implements `prd.md` in a staged, low-risk way. It is ordered by highest leverage first.

---

## Phase 0 - Baseline and guardrails

### ~~Task 1: Establish baseline quality scoreboard~~ ✅

**Refs:** QUAL-1, QUAL-2, OBS-1
**Files:** `GENERATED_EXAMPLES.md`, new `scripts/evals/` folder, new `docs/evals-baseline.md`

**What to do**

- ~~Build a fixed eval set of URLs (at least 50) across topics.~~
- ~~Define rubric dimensions: specificity, originality, voice, platform compliance.~~
- ~~Save baseline scores from current pipeline for before/after comparison.~~

### ~~Task 2: Add structured generation telemetry contract~~ ✅

**Refs:** OBS-2
**Files:** `src/app/api/posts/generate/route.ts`, `src/lib/types/streaming.ts`

**What to do**

- ~~Add structured event payloads for `chunk_count`, `model_id`, `rewrite_attempts`, and `validation_failures`.~~
- ~~Include trace IDs per generation request.~~

---

## Phase 1 - Data integrity and iteration model

### ~~Task 3: Fix training post storage semantics~~ ✅

**Refs:** DATA-1, DATA-2, DATA-3  
**Files:** `src/app/api/posts/train/route.ts`, `src/db/schemas/training-post.ts`, new drizzle migration

**What to do**

- Save `validatedBody.post_content` into `training_posts.post_content`.
- Store scraped source text in a dedicated field/table instead of overwriting post content.
- Add server-side checks to reject article-dump-like training inputs.

### ~~Task 4: Enable multiple generated drafts per URL~~ ✅

**Refs:** ITER-1, DATA-4  
**Files:** `src/db/schemas/generate-post.ts`, new drizzle migration, `src/app/api/posts/generate/route.ts`

**What to do**

- Remove or relax unique `(user_id, original_url)` restriction.
- Add draft version metadata (`version`, `parent_id`, `quality_score` optional).
- Keep full history for comparison and learning.

### ~~Task 5: Data cleanup and backfill~~ ✅

**Refs:** DATA-1, DATA-2  
**Files:** new `scripts/data-fixes/` scripts, optional admin API

**What to do**

- Identify bad training rows that contain long scraped pages.
- Mark, archive, or delete invalid rows.
- Backfill required metadata for surviving rows.

---

## Phase 2 - Chunking foundation (milkpod-style)

### ~~Task 6: Implement recursive content chunker~~ ✅

**Refs:** CHUNK-2, CHUNK-3  
**Files:** new `src/lib/ai/chunking.ts`, `src/lib/constants.tsx`

**What to do**

- Port the recursive separator strategy from `../milkpod/packages/ai/src/embeddings.ts`.
- Keep overlap support and hard max chunk length guarantees.
- Expose configurable separators and overlap percentages.

### ~~Task 7: Implement adaptive chunk config~~ ✅

**Refs:** CHUNK-2  
**Files:** `src/lib/ai/chunking.ts`

**What to do**

- Port adaptive size strategy from `../milkpod/packages/api/src/modules/moments/chunking.ts`.
- Start with 500-2000 chars and ~15% overlap.
- Tune by source length to balance quality, speed, and cost.

### ~~Task 8: Build chunk-level analysis reducer~~ ✅

**Refs:** CHUNK-4, CHUNK-5  
**Files:** `src/app/api/posts/generate/route.ts`, new `src/lib/ai/reducer.ts`

**What to do**

- Analyze each chunk independently for claims/stats/angles/quotes.
- Merge chunk insights into a compact generation brief.
- Prefer chunks with concrete details and novelty.

### Task 9: Add chunking tests

**Refs:** CHUNK-6  
**Files:** new `src/lib/ai/chunking.test.ts`

**What to do**

- Mirror edge-case coverage from `../milkpod/packages/api/src/modules/moments/chunking.test.ts`.
- Add deterministic snapshot-style test fixtures.

---

## Phase 3 - Retrieval and context quality

### Task 10: Fix tone similarity scoring

**Refs:** RET-1, RET-2  
**Files:** `src/lib/constants.tsx`, `src/app/api/posts/generate/route.ts`

**What to do**

- Align threshold units to 0-100 tone weights.
- Replace binary match logic with weighted distance scoring.

### Task 11: Add chunk embedding storage

**Refs:** RET-2, CHUNK-4  
**Files:** new `src/db/schemas/content-chunk.ts`, new migration, `src/db/schemas/index.ts`

**What to do**

- Store chunk text + embedding + source offsets.
- Add pgvector index for fast similarity search.

### Task 12: Hybrid retrieval and diversity rerank

**Refs:** RET-2, RET-3  
**Files:** `src/app/api/posts/generate/route.ts`, new `src/lib/ai/retrieval.ts`

**What to do**

- Combine metadata filters, tone score, and embedding similarity.
- De-duplicate near-identical examples.
- Return diverse final few-shot pack.

### Task 13: Retrieval fallback modes

**Refs:** RET-2  
**Files:** `src/app/api/posts/generate/route.ts`

**What to do**

- If vector search fails, fallback to metadata + lexical scoring.
- Keep generation resilient even with partial infra issues.

---

## Phase 4 - Writing quality and platform correctness

### Task 14: Model routing by stage

**Refs:** GEN-1, GEN-3  
**Files:** `src/app/api/posts/generate/route.ts`, `src/app/api/posts/train/route.ts`, new `src/lib/ai/models.ts`

**What to do**

- Keep analysis on fast model.
- Move final writing and rewrite/critic pass to stronger model.
- Centralize model IDs in one config file.

### Task 15: Rewrite prompt spec for voice and anti-slop

**Refs:** GEN-2, GEN-4  
**Files:** `src/app/api/posts/generate/route.ts`, `src/lib/ai/utils.ts`, new `src/lib/ai/prompt-spec.ts`

**What to do**

- Remove "professional social media copywriter" persona.
- Add explicit anti-pattern bans and positive style constraints.
- Inject "specific detail required" and "opinion required" constraints.

### Task 16: Multi-candidate generation + judge pass

**Refs:** GEN-5  
**Files:** `src/app/api/posts/generate/route.ts`, new `src/lib/ai/judge.ts`

**What to do**

- Generate 3-5 candidates.
- Score using rubric and choose winner.
- Keep top alternative for user choice.

### Task 17: Hard platform validator + auto-rewrite loop

**Refs:** PLAT-1, PLAT-2, PLAT-3  
**Files:** new `src/lib/ai/validator.ts`, `src/app/api/posts/generate/route.ts`

**What to do**

- Validate char counts, hashtag caps, emoji caps, banned phrases.
- Reject invalid drafts and rewrite up to max retries.
- Persist only validated output.

---

## Phase 5 - UX and workflow improvements

### Task 18: Add regenerate and draft history UX

**Refs:** UX-2, DATA-4  
**Files:** `src/components/forms/generate-post-form.tsx`, new history/list UI component

**What to do**

- Add "Regenerate" action for same URL.
- Show draft list with timestamps and quick copy.

### Task 19: Add explainability panel

**Refs:** UX-3  
**Files:** `src/components/forms/generate-post-form.tsx`, `src/lib/types/streaming.ts`

**What to do**

- Display key extracted source points and final score breakdown.
- Surface why a candidate won.

### Task 20: Add advanced writing controls

**Refs:** UX-4  
**Files:** `src/components/forms/generate-post-form.tsx`, `src/lib/schemas/post.ts`, `src/app/api/posts/generate/route.ts`

**What to do**

- Add controls for brevity, edginess, CTA strength, hashtag aggressiveness.
- Feed controls into generation and judge rubric.

### Task 21: Fix broken training form analyze action

**Refs:** UX-1  
**Files:** `src/components/forms/post-form.tsx`

**What to do**

- Replace dead `/api/posts` call with valid endpoint or remove button.
- Ensure training workflow is coherent and debuggable.

---

## Phase 6 - Voice learning and rollout

### Task 22: Implement voice memory profile

**Refs:** GEN-6  
**Files:** new `src/db/schemas/voice-profile.ts`, migration, generation route updates

**What to do**

- Capture accepted draft signals (selected variant, user edits).
- Compute lightweight user style profile and apply in prompts.

### Task 23: Add feature flags and staged rollout

**Refs:** GEN-3, GEN-5, PLAT-3  
**Files:** new `src/lib/feature-flags.ts`, generation route

**What to do**

- Gate new pipeline parts (chunking, judge pass, rewrite loop) behind flags.
- Roll out incrementally and compare key metrics.

### Task 24: Run full eval + production cutover

**Refs:** QUAL-2, Success Metrics in `prd.md`  
**Files:** eval scripts and release checklist doc

**What to do**

- Run benchmark against baseline.
- Confirm threshold targets (quality + compliance + latency).
- Make v2 pipeline the default only after passing gates.

---

## Implementation notes

- Keep migrations backward compatible where possible.
- Prioritize data integrity and validator enforcement before UX polish.
- Any task that touches generation should include at least one deterministic regression fixture.
