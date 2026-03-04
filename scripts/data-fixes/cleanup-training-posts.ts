/**
 * Deletes training_posts rows where post_content is contaminated with
 * scraped article text (pre-Task 3 DATA-1 bug).
 *
 * Runs in dry-run mode by default. Pass --execute to actually delete.
 *
 * Usage:
 *   npx tsx scripts/data-fixes/cleanup-training-posts.ts              # dry run
 *   npx tsx scripts/data-fixes/cleanup-training-posts.ts --execute     # delete bad rows
 */

import 'dotenv/config';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { training_posts } from '../../src/db/schemas';

const db = drizzle(process.env.DATABASE_URL!);

// ---------------------------------------------------------------------------
// Article-dump detection (mirrors src/app/api/posts/train/route.ts)
// ---------------------------------------------------------------------------

function isArticleDump(content: string): boolean {
  if (/^#{1,6}\s/m.test(content)) return true;
  if (content.includes('```')) return true;
  if (/!\[.*\]\(.*\)/.test(content)) return true;
  if (content.split(/\s+/).length > 1000) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const execute = process.argv.includes('--execute');

  const rows = await db
    .select({
      id: training_posts.id,
      post_content: training_posts.post_content,
      original_url: training_posts.original_url,
    })
    .from(training_posts);

  const badIds: string[] = [];
  for (const row of rows) {
    if (isArticleDump(row.post_content)) {
      badIds.push(row.id);
    }
  }

  console.log(`Total rows:   ${rows.length}`);
  console.log(`Bad rows:     ${badIds.length}`);
  console.log(`Clean rows:   ${rows.length - badIds.length}`);

  if (badIds.length === 0) {
    console.log('\nNo contaminated rows found. Nothing to do.');
    process.exit(0);
  }

  if (!execute) {
    console.log('\n[DRY RUN] Would delete the following row IDs:');
    for (const id of badIds) {
      console.log(`  - ${id}`);
    }
    console.log('\nRe-run with --execute to apply deletions.');
    process.exit(0);
  }

  // Batch delete in chunks of 100
  const BATCH_SIZE = 100;
  let deleted = 0;
  for (let i = 0; i < badIds.length; i += BATCH_SIZE) {
    const batch = badIds.slice(i, i + BATCH_SIZE);
    const result = await db
      .delete(training_posts)
      .where(inArray(training_posts.id, batch));
    deleted += result.rowCount ?? batch.length;
  }

  console.log(`\nDeleted ${deleted} contaminated training posts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
