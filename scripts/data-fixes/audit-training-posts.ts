/**
 * Audits training_posts for rows where post_content is contaminated with
 * scraped article text (pre-Task 3 DATA-1 bug).
 *
 * Heuristics match the isArticleDump guard added in Task 3:
 *   - Markdown headers (# ...)
 *   - Code fences (```)
 *   - Markdown images (![...](...)
 *   - Excessive word count (> 1000 words)
 *   - Missing source_content (pre-Task 3 rows)
 *
 * Usage:
 *   npx tsx scripts/data-fixes/audit-training-posts.ts
 *   npx tsx scripts/data-fixes/audit-training-posts.ts --output report.json
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { training_posts } from '../../src/db/schemas';

const db = drizzle(process.env.DATABASE_URL!);

// ---------------------------------------------------------------------------
// Article-dump detection (mirrors src/app/api/posts/train/route.ts)
// ---------------------------------------------------------------------------

interface AuditFlag {
  has_markdown_headers: boolean;
  has_code_fences: boolean;
  has_markdown_images: boolean;
  excessive_word_count: boolean;
  word_count: number;
  missing_source_content: boolean;
}

function auditRow(row: {
  post_content: string;
  source_content: string | null;
}): AuditFlag {
  const content = row.post_content;
  const wordCount = content.split(/\s+/).length;

  return {
    has_markdown_headers: /^#{1,6}\s/m.test(content),
    has_code_fences: content.includes('```'),
    has_markdown_images: /!\[.*\]\(.*\)/.test(content),
    excessive_word_count: wordCount > 1000,
    word_count: wordCount,
    missing_source_content: !row.source_content,
  };
}

function isBadRow(flags: AuditFlag): boolean {
  return (
    flags.has_markdown_headers ||
    flags.has_code_fences ||
    flags.has_markdown_images ||
    flags.excessive_word_count
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const outputPath =
    process.argv.includes('--output') &&
    process.argv[process.argv.indexOf('--output') + 1]
      ? resolve(process.argv[process.argv.indexOf('--output') + 1]!)
      : resolve('scripts/data-fixes/audit-report.json');

  const rows = await db
    .select({
      id: training_posts.id,
      post_content: training_posts.post_content,
      source_content: training_posts.source_content,
      original_url: training_posts.original_url,
      platforms: training_posts.platforms,
      user_id: training_posts.user_id,
      createdAt: training_posts.createdAt,
    })
    .from(training_posts);

  console.log(`Total training posts: ${rows.length}`);

  const badRows: Array<{
    id: string;
    original_url: string;
    platforms: string;
    user_id: string;
    created_at: string;
    post_content_preview: string;
    flags: AuditFlag;
  }> = [];

  let missingSourceContent = 0;

  for (const row of rows) {
    const flags = auditRow(row);

    if (!row.source_content) {
      missingSourceContent++;
    }

    if (isBadRow(flags)) {
      badRows.push({
        id: row.id,
        original_url: row.original_url,
        platforms: row.platforms,
        user_id: row.user_id,
        created_at: row.createdAt.toISOString(),
        post_content_preview: row.post_content.slice(0, 200),
        flags,
      });
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    total_rows: rows.length,
    bad_rows: badRows.length,
    clean_rows: rows.length - badRows.length,
    missing_source_content: missingSourceContent,
    bad_row_details: badRows,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`\n--- Audit Report ---`);
  console.log(`Total rows:              ${report.total_rows}`);
  console.log(`Bad rows (article dump): ${report.bad_rows}`);
  console.log(`Clean rows:              ${report.clean_rows}`);
  console.log(`Missing source_content:  ${report.missing_source_content}`);
  console.log(`\nFull report written to ${outputPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
