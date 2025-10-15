import { pgTable, text, varchar } from 'drizzle-orm/pg-core';
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
  ...lifecycle_dates,
});
