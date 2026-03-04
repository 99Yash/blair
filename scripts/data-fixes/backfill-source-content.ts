/**
 * Backfills missing source_content for training_posts rows.
 *
 * The source_content column was added in Task 3. Rows created before that
 * migration have NULL source_content. This script re-scrapes original_url
 * for those rows and populates the field.
 *
 * Runs in dry-run mode by default. Pass --execute to scrape and update.
 *
 * Usage:
 *   npx tsx scripts/data-fixes/backfill-source-content.ts              # dry run
 *   npx tsx scripts/data-fixes/backfill-source-content.ts --execute     # scrape + update
 *   npx tsx scripts/data-fixes/backfill-source-content.ts --execute --concurrency 3
 */

import 'dotenv/config';
import Firecrawl from '@mendable/firecrawl-js';
import { eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { training_posts } from '../../src/db/schemas';

const db = drizzle(process.env.DATABASE_URL!);
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function argValue(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
  return process.argv[idx + 1];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const execute = process.argv.includes('--execute');
  const concurrency = parseInt(argValue('concurrency') ?? '2', 10);

  const rows = await db
    .select({
      id: training_posts.id,
      original_url: training_posts.original_url,
    })
    .from(training_posts)
    .where(isNull(training_posts.source_content));

  console.log(`Rows missing source_content: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nothing to backfill.');
    process.exit(0);
  }

  if (!execute) {
    console.log('\n[DRY RUN] Would re-scrape and backfill these rows:');
    for (const row of rows) {
      console.log(`  - ${row.id}: ${row.original_url}`);
    }
    console.log(`\nRe-run with --execute to apply (concurrency: ${concurrency}).`);
    process.exit(0);
  }

  let succeeded = 0;
  let failed = 0;

  // Process in batches respecting concurrency
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const scraped = await firecrawl.scrape(row.original_url, {
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 1000,
        });

        const markdown = scraped.markdown ?? '';

        await db
          .update(training_posts)
          .set({ source_content: markdown })
          .where(eq(training_posts.id, row.id));

        return row.id;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        succeeded++;
        console.log(`  OK: ${result.value}`);
      } else {
        failed++;
        console.error(`  FAIL: ${result.reason}`);
      }
    }
  }

  console.log(`\nBackfill complete: ${succeeded} succeeded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
