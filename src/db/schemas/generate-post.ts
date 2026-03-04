import { integer, numeric, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { createId, lifecycle_dates } from './helpers';
import {
  linkOwnershipTypeEnum,
  linkTypeEnum,
  platforms,
  targetAudienceEnum,
} from './training-post';

export const generate_posts = pgTable('generate_posts', {
  id: varchar('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  post_content: text('post_content').notNull(),
  platform: platforms('platforms').notNull(),
  content_type: linkTypeEnum('content_type').notNull(),
  original_url: text('original_url').notNull(),
  content_summary: text('content_summary').notNull(),
  target_audience:
    targetAudienceEnum('target_audience').default('general_public'),
  link_ownership_type: linkOwnershipTypeEnum('link_ownership_type').default(
    'own_content'
  ),
  user_id: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  parent_id: varchar('parent_id'),
  quality_score: numeric('quality_score', { precision: 4, scale: 2 }),
  ...lifecycle_dates,
}, (table) => [
  uniqueIndex('unique_user_url_version').on(table.user_id, table.original_url, table.version),
]);
