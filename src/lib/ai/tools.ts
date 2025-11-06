import { google } from '@ai-sdk/google';
import { generateObject, tool } from 'ai';
import { and, eq, or, sql } from 'drizzle-orm';
import * as z from 'zod/v4';
import { db } from '~/db';
import {
  linkOwnershipTypeEnum,
  linkTypeEnum,
  platforms,
  targetAudienceEnum,
  toneEnum,
  training_posts,
} from '~/db/schemas';
import { firecrawl } from '../firecrawl';
import { scrapedContentAnalysisSchema } from '../schemas/post';
import { getErrorMessage } from '../utils';

export const scrapeWebsiteTool = tool({
  name: 'scrape_website',
  description: 'Scrape a website, and generate a summary of the contents.',
  inputSchema: z.object({
    url: z.url(),
  }),
  execute: async ({ url }) => {
    const scrapedContent = await firecrawl.scrape(url.toString(), {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 1000,
    });

    const content = scrapedContent.markdown ?? scrapedContent.html ?? '';
    const slicedContent = content.slice(0, 100000);

    const { object: analysis } = await generateObject({
      model: google('gemini-2.0-flash-lite'),
      schema: scrapedContentAnalysisSchema,
      prompt: `Analyze the following scraped content: ${slicedContent} and return the analysis in the schema provided.`,
    });

    return {
      content_summary: analysis.content_summary,
      content_type: analysis.content_type,
      target_audience: analysis.target_audience,
      tone_profile: analysis.tone_profile,
      sales_pitch_strength: analysis.sales_pitch_strength,
    };
  },
});

export const searchTrainingPostsTool = tool({
  name: 'search_training_posts',
  description:
    'Search the database for relevant training posts based on platform, content type, tone profile, target audience, and other criteria. This tool helps find examples of successful social media posts that match the desired characteristics.',
  inputSchema: z.object({
    // Filters to refine the search. These map directly to our schema fields.
    link_type: z
      .enum(linkTypeEnum.enumValues)
      .optional()
      .describe(
        'The category of the content being linked to (e.g., "self_help", "tech_tutorial").'
      ),
    platform: z
      .enum(platforms.enumValues)
      .optional()
      .describe(
        'The social media platform where the original training post was published (e.g., "twitter", "linkedin").'
      ),
    link_ownership_type: z
      .enum(linkOwnershipTypeEnum.enumValues)
      .optional()
      .describe(
        'Whether the linked content is "own_content" (self-promotion) or "third_party_content" (sharing someone else\'s work).'
      ),
    target_audience: z
      .enum(targetAudienceEnum.enumValues)
      .optional()
      .describe(
        'The primary target audience for the teased content (e.g., "developers", "entrepreneurs").'
      ),
    min_sales_pitch_strength: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Minimum desired sales pitch strength (1-100).'),
    max_sales_pitch_strength: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum desired sales pitch strength (1-100).'),
    desired_tone: z
      .enum(toneEnum.enumValues)
      .optional()
      .describe(
        'A single desired primary tone for the teaser (e.g., "witty", "professional"). This will prioritize posts with this tone in their tone_profile.'
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .optional()
      .describe('The maximum number of relevant training posts to retrieve.'),
  }),
  execute: async ({
    link_type,
    platform,
    link_ownership_type,
    target_audience,
    min_sales_pitch_strength,
    max_sales_pitch_strength,
    desired_tone,
    limit = 5,
  }) => {
    try {
      // Build dynamic where clauses for exact matches first
      const exactMatchClauses = [];

      if (platform) {
        exactMatchClauses.push(eq(training_posts.platforms, platform));
      }
      if (link_type) {
        exactMatchClauses.push(eq(training_posts.content_type, link_type));
      }
      if (link_ownership_type) {
        exactMatchClauses.push(
          eq(training_posts.link_ownership_type, link_ownership_type)
        );
      }
      if (target_audience) {
        exactMatchClauses.push(
          eq(training_posts.target_audience, target_audience)
        );
      }

      // Sales pitch strength filter
      if (
        min_sales_pitch_strength !== undefined ||
        max_sales_pitch_strength !== undefined
      ) {
        const minStrength = min_sales_pitch_strength || 1;
        const maxStrength = max_sales_pitch_strength || 100;
        exactMatchClauses.push(
          sql`${training_posts.sales_pitch_strength} >= ${minStrength} AND ${training_posts.sales_pitch_strength} <= ${maxStrength}`
        );
      }

      // First, try to find exact matches
      let results: (typeof training_posts.$inferSelect)[] = [];
      if (exactMatchClauses.length > 0) {
        const exactMatchQuery = db
          .select()
          .from(training_posts)
          .where(and(...exactMatchClauses))
          .limit(limit);

        results = await exactMatchQuery;
      }

      // If no exact matches found, try broader search
      if (results.length === 0 && exactMatchClauses.length > 0) {
        // Try with fewer filters - prioritize the most important ones
        const priorityFilters = [];
        if (platform)
          priorityFilters.push(eq(training_posts.platforms, platform));
        if (link_type)
          priorityFilters.push(eq(training_posts.content_type, link_type));

        if (priorityFilters.length > 0) {
          const priorityQuery = db
            .select()
            .from(training_posts)
            .where(and(...priorityFilters))
            .limit(limit);
          results = await priorityQuery;
        }

        // If still no results, get any posts that match at least one key criterion
        if (results.length === 0) {
          const anyMatchClauses = [];
          if (platform)
            anyMatchClauses.push(eq(training_posts.platforms, platform));
          if (link_type)
            anyMatchClauses.push(eq(training_posts.content_type, link_type));
          if (target_audience)
            anyMatchClauses.push(
              eq(training_posts.target_audience, target_audience)
            );

          if (anyMatchClauses.length > 0) {
            const anyMatchQuery = db
              .select()
              .from(training_posts)
              .where(
                anyMatchClauses.length === 1
                  ? anyMatchClauses[0]
                  : or(...anyMatchClauses)
              )
              .limit(limit);
            results = await anyMatchQuery;
          }
        }

        // If still no results, just get some recent posts as fallback
        if (results.length === 0) {
          const fallbackQuery = db
            .select()
            .from(training_posts)
            .orderBy(sql`${training_posts.createdAt} DESC`)
            .limit(limit);
          results = await fallbackQuery;
        }
      }

      // If we still don't have results, return empty
      if (results.length === 0) {
        return {
          results: [],
          message:
            'No relevant training posts found matching the criteria. Try broadening your query or filters.',
        };
      }

      // Score results based on tone profile match if desired_tone is specified
      let scoredResults: (typeof training_posts.$inferSelect & {
        toneScore?: number;
      })[] = results;
      if (desired_tone) {
        scoredResults = results
          .map((post) => {
            let toneScore = 0;
            if (post.tone_profile) {
              const toneEntry = post.tone_profile.find(
                (t: { tone: string; weight: number }) => t.tone === desired_tone
              );
              if (toneEntry) {
                toneScore = toneEntry.weight / 100; // Normalize to 0-1
              }
            }

            return { ...post, toneScore };
          })
          .sort((a, b) => (b.toneScore || 0) - (a.toneScore || 0));
      }

      // Sanitize output before returning to LLM
      const sanitizedResults = scoredResults.map((post) => ({
        post_content: post.post_content,
        content_summary: post.content_summary,
        platform: post.platforms,
        content_type: post.content_type,
        link_ownership_type: post.link_ownership_type,
        target_audience: post.target_audience,
        sales_pitch_strength: post.sales_pitch_strength,
        tone_profile: post.tone_profile,
      }));

      return {
        results: sanitizedResults,
        message: `Successfully retrieved ${
          sanitizedResults.length
        } relevant training post${sanitizedResults.length === 1 ? '' : 's'}.`,
      };
    } catch (error) {
      console.error('Error searching training posts:', error);
      return {
        results: [],
        message: `An error occurred: ${getErrorMessage(error)}`,
      };
    }
  },
});
