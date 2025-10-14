import * as z from 'zod/v4';
import { POST_CONTENT_MAX_LENGTH } from '../constants';

export const postFormSchema = z.object({
  post_content: z
    .string()
    .min(1, 'Post content is required')
    .max(
      POST_CONTENT_MAX_LENGTH,
      `Post content must be less than ${POST_CONTENT_MAX_LENGTH} characters`
    ),
  platform: z.enum(['twitter', 'instagram', 'facebook', 'linkedin'], {
    message: 'Platform is required',
  }),
  content_type: z.enum(
    [
      'self_help',
      'tech_tutorial',
      'news_article',
      'product_review',
      'thought_leadership',
      'entertainment',
      'other',
    ],
    {
      message: 'Content type is required',
    }
  ),
  original_url: z.url('Must be a valid URL').min(1, 'URL is required'),
  content_summary: z
    .string()
    .min(1, 'Content summary is required')
    .max(1000, 'Content summary must be less than 1000 characters'),
  call_to_action_type: z.enum(
    [
      'learn_more',
      'sign_up',
      'buy_now',
      'read_article',
      'watch_video',
      'download',
      'join_community',
      'poll_question',
      'other',
    ],
    {
      message: 'Call to action type is required',
    }
  ),
  sales_pitch_strength: z.number().min(0).max(100),
  tone_profile: z
    .array(
      z.object({
        tone: z.enum([
          'witty',
          'professional',
          'inspirational',
          'casual',
          'direct',
          'empathetic',
        ]),
        weight: z.number().min(0).max(100),
      })
    )
    .min(1, 'At least one tone profile is required'),
  link_ownership_type: z.enum(['own_content', 'third_party_content'], {
    message: 'Link ownership type is required',
  }),
  target_audience: z.enum(
    [
      'developers',
      'marketers',
      'entrepreneurs',
      'students',
      'parents',
      'general_public',
      'creatives',
      'finance_professionals',
      'other',
    ],
    {
      message: 'Target audience is required',
    }
  ),
});

export type PostFormData = z.infer<typeof postFormSchema>;

export const scrapedContentAnalysisSchema = z.object({
  content_summary: z
    .string()
    .min(1)
    .max(1000)
    .describe('The summary of the scraped content'),
  content_type: z
    .enum([
      'self_help',
      'tech_tutorial',
      'news_article',
      'product_review',
      'thought_leadership',
      'entertainment',
      'other',
    ])
    .describe('The type of content of the scraped page'),
  target_audience: z
    .enum([
      'developers',
      'marketers',
      'entrepreneurs',
      'students',
      'parents',
      'general_public',
      'creatives',
      'finance_professionals',
      'other',
    ])
    .describe('The target audience of the scraped content'),
  tone_profile: z
    .array(
      z.object({
        tone: z.enum([
          'witty',
          'professional',
          'inspirational',
          'casual',
          'direct',
          'empathetic',
        ]),
        weight: z.number().min(0).max(100),
      })
    )
    .min(1)
    .describe('The primary tone(s) used in the scraped content'),
  call_to_action_type: z
    .enum([
      'learn_more',
      'sign_up',
      'buy_now',
      'read_article',
      'watch_video',
      'download',
      'join_community',
      'poll_question',
      'other',
    ])
    .describe('The call to action type of the scraped content'),
  sales_pitch_strength: z
    .number()
    .min(0)
    .max(100)
    .describe(
      'The sales pitch strength of the scraped content, as an integer.'
    ),
});

export type ScrapedContentAnalysis = z.infer<
  typeof scrapedContentAnalysisSchema
>;

export const inferredPostSchema = z.object({
  content_summary: z
    .string()
    .min(1)
    .max(1000)
    .describe('The summary of the post'),
  target_audience: z
    .enum([
      'developers',
      'marketers',
      'entrepreneurs',
      'students',
      'parents',
      'general_public',
      'creatives',
      'finance_professionals',
      'other',
    ])
    .describe('The target audience of the post'),
  tone_profile: z
    .array(
      z.object({
        tone: z.enum([
          'witty',
          'professional',
          'inspirational',
          'casual',
          'direct',
          'empathetic',
        ]),
        weight: z.number().min(0).max(100),
      })
    )
    .min(1),
  call_to_action_type: z
    .enum([
      'learn_more',
      'sign_up',
      'buy_now',
      'read_article',
      'watch_video',
      'download',
      'join_community',
      'poll_question',
      'other',
    ])
    .describe('The call to action type of the post'),
});

export type InferredPostData = z.infer<typeof inferredPostSchema>;
