import { relations } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  varchar,
  vector,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { createId, lifecycle_dates } from './helpers';

export const linkTypeEnum = pgEnum('link_type', [
  'self_help',
  'tech_tutorial',
  'news_article',
  'product_review',
  'thought_leadership',
  'entertainment',
  'other',
]);

export const platforms = pgEnum('platform', [
  'twitter',
  'instagram',
  'facebook',
  'linkedin',
]);

export const toneEnum = pgEnum('tone', [
  'witty',
  'professional',
  'inspirational',
  'casual',
  'direct',
  'empathetic',
]);

export const linkOwnershipTypeEnum = pgEnum('link_ownership_type', [
  'own_content',
  'third_party_content',
]);

export const targetAudienceEnum = pgEnum('target_audience', [
  'developers',
  'marketers',
  'entrepreneurs',
  'students',
  'parents',
  'general_public',
  'creatives',
  'finance_professionals',
  'other',
]);

export const ctaTypeEnum = pgEnum('cta_type', [
  'learn_more',
  'sign_up',
  'buy_now',
  'read_article',
  'watch_video',
  'download',
  'join_community',
  'poll_question',
  'other',
]);

export const training_posts = pgTable('training_posts', {
  id: varchar('id')
    .$defaultFn(() => createId())
    .primaryKey(),
  post_content: text('post_content').notNull(),
  platform: platforms('platforms').notNull(),
  content_type: linkTypeEnum('content_type').notNull(),
  original_url: text('original_url').notNull(),
  content_summary: text('content_summary').notNull(),
  call_to_action_type: ctaTypeEnum('call_to_action_type').notNull(),
  sales_pitch_strength: integer('sales_pitch_strength').notNull().default(100),
  tone_profile: jsonb('tone_profile')
    .$type<
      Array<{ tone: (typeof toneEnum.enumValues)[number]; weight: number }> // max weight is 100
    >()
    .notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // post embedding
  content_summary_embedding: vector('content_summary_embedding', {
    dimensions: 1536, // content summary embedding
  }),
  link_ownership_type: linkOwnershipTypeEnum('link_ownership_type').notNull(),
  target_audience: targetAudienceEnum('target_audience').notNull(),
  user_id: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...lifecycle_dates,
});

export const postRelations = relations(training_posts, ({ one }) => ({
  user: one(user, {
    fields: [training_posts.user_id],
    references: [user.id],
  }),
}));
