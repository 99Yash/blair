# Blair - Generated Content Examples & Problems

Database snapshot from 2026-03-04. 33 generated posts, 3 training posts.

---

## The Core Problems

### 1. Every generated post sounds the same

They all follow the exact same template:
- Generic opener ("Discover...", "Unlock...", "Exciting news!")
- 2-3 lines of empty buzzwords ("Elevate", "Streamline", "Dive in")
- URL slapped at the end
- Hashtags

There is zero personality, zero opinion, zero edge. It reads like a LinkedIn bot from 2019.

### 2. Training data is broken

Only 3 training posts exist. At least one (the Dan Koe Substack) has the **entire raw scraped webpage** as its `post_content` — not an actual post. So the few-shot examples being fed to the model are literal HTML dumps, not curated social media posts.

### 3. The model (`gemini-2.0-flash-lite`) is too weak

Flash Lite is optimized for speed/cost, not creative writing quality. It produces the most generic, safe output possible.

### 4. The prompt is corporate slop

"You are a professional social media copywriter" → produces exactly what corporate copywriters produce: nothing worth reading.

### 5. Tone profile has no real effect

Whether you pick "witty", "direct", or "casual", the output is functionally identical. The tone weights are passed to the prompt but Gemini Flash Lite doesn't meaningfully differentiate.

### 6. Many Twitter posts blow past 280 chars

Posts 10-33 are all well over 280 characters despite Twitter's hard limit.

---

## Sample Generated Posts (Twitter)

### Post 1 — PostgreSQL EXPLAIN tutorial
> Demystifying PostgreSQL's EXPLAIN command! 🧐 This tutorial breaks down query plans, costs, & estimates. Learn how to interpret the numbers and optimize your queries.
>
> Check it out: https://www.depesz.com/2013/04/16/explaining-the-unexplainable/
>
> #PostgreSQL

**Verdict:** Generic "check it out" energy. No opinion on why this matters.

---

### Post 2 — Biome lint rule
> Uncover the secrets behind stress testing Biome's `noFloatingPromises` lint rule!
>
> Explore techniques to catch unhandled Promises and learn from creative examples shared among our developers.
>
> Together, we can elevate the open-source community.
>
> Read more: ... #JavaScript #OpenSource

**Verdict:** "Together, we can elevate the open-source community" — nobody talks like this. Corporate AI slop.

---

### Post 4 — Stripe Ledger
> Unlock the power of financial data with Stripe's Ledger. 🧾
> Track money movement with 99.9999% explainability and combine complex transactions into a clear, auditable log.
> Empower your development and ensure accuracy in every transaction.
>
> Learn more: ... #FinanceTech

**Verdict:** "Unlock the power" + "Empower your development" — double empower combo. Zero personality.

---

### Post 6 — Vercel Bloom Filters
> Unlock faster global routing! 🚀
>
> Discover how Vercel slashed latency from 250ms to nearly zero by implementing Bloom filters for path lookups.
>
> Enhance your static websites and boost performance today.
>
> Read more: ... #WebPerformance

**Verdict:** At least has a concrete stat (250ms → ~0). But "Enhance your static websites and boost performance today" is meaningless filler.

---

### Post 12 — Vercel v0 Ambassador Program
> Exciting news for developers! Vercel's v0 Ambassador Program is now live, designed to support and recognize community members who innovate with v0. This is your chance to gain valuable benefits like credits, early access to features, and enhanced visibility for your projects. If you're passionate about sharing your creations and showcasing the power of v0, we want you on board. Join us in building a vibrant community—apply now to become an ambassador and make your mark! Sign up here: ...

**Verdict:** 505 characters for a "Twitter" post. Way over 280. Reads like a press release.

---

### Post 21 — Anthropic writing tools for agents
> Unlock the potential of AI agents with our latest guide! Dive into effective writing strategies for tools like Claude Code. Learn about choosing the right tools, optimizing token efficiency, and much more. Perfect for developers looking to enhance agent performance. Read the article: ...

**Verdict:** "Unlock the potential... Dive into... Learn about... Perfect for..." — the four horsemen of generic AI copy.

---

### Post 28 — Vercel AI security
> 🔒 Building AI agents? Beware of security pitfalls! This in-depth guide sheds light on prompt injection vulnerabilities and best practices to safeguard your AI projects. Design with caution and arm yourself with strategies to minimize risks.
>
> 👉 Dive into the article now: ...
>
> #AI #CyberSecurity #Developers #TechSafety #AIrisks #ReadArticle

**Verdict:** 6 hashtags. "#ReadArticle" as a hashtag. Nobody searches "#ReadArticle".

---

### Post 33 — Postgres indexes
> 🚀 Dive into PostgreSQL magic! 🧙‍♂️ Unlock the power of B-tree indexes and supercharge your database queries! 🌟 Adam Rackis breaks it down with hands-on demos and visual guides. Don't miss part one of this eye-opening series!
>
> 🔗 Read more: ... #PostgreSQL #DevLife #TechTutorials

**Verdict:** 🚀🧙‍♂️🌟🔗 — four emojis in a tweet about database indexes. "Supercharge your database queries!" is not how anyone talks.

---

## Training Posts (what feeds few-shot examples)

### Training Post 1 — Dan Koe Substack
- Platform: twitter
- Type: self_help
- Tones: direct (0.6), inspirational (0.4)
- `post_content`: **The entire raw scraped webpage** (~6000+ words of Substack article HTML/markdown). Not a post at all.

### Training Posts 2 & 3
- Not shown in full dump but same pattern likely applies.

---

## What Good Posts Actually Look Like

For comparison, here's what a human developer would actually tweet about Postgres EXPLAIN:

> spent 3 hours debugging a slow query. turned out I was missing an index on a 50M row table.
>
> EXPLAIN ANALYZE showed a seq scan taking 12s → 3ms with a btree index.
>
> if you're not reading your query plans, you're guessing.

Or about Stripe Ledger:

> stripe's ledger system tracks every cent across their entire platform with 99.9999% accuracy.
>
> the interesting part isn't the accuracy — it's how they handle the 0.0001% that doesn't match.

---

## What Needs to Change

1. **Better model** — At minimum `gemini-2.0-flash` (not lite), or Claude Sonnet/Haiku for creative tasks
2. **Better prompt** — Kill the "professional social media copywriter" framing. Instruct for specific voice: concise, opinionated, no fluff, no empty encouragement
3. **Fix training data** — Training posts should be actual curated social media posts, not raw scraped pages
4. **Enforce character limits** — Hard-reject tweets over 280 chars and regenerate
5. **Anti-patterns list** — Explicitly ban: "Unlock the power", "Dive in", "Discover", "Elevate", emoji spam, "#ReadArticle"-tier hashtags
6. **Allow regeneration** — The unique constraint on (user_id, original_url) prevents iterating on the same URL
