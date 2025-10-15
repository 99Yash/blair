import { openai } from '@ai-sdk/openai';
import { embed, generateObject, tool } from 'ai';
import { and, eq, sql } from 'drizzle-orm';
import * as z from 'zod/v4';
import { db } from '~/db';
import {
  ctaTypeEnum,
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
      model: openai('gpt-4o-mini'),
      schema: scrapedContentAnalysisSchema,
      prompt: `Analyze the following scraped content: ${slicedContent} and return the analysis in the schema provided.`,
    });

    return {
      content_summary: analysis.content_summary,
      content_type: analysis.content_type,
      target_audience: analysis.target_audience,
      tone_profile: analysis.tone_profile,
      call_to_action_type: analysis.call_to_action_type,
      sales_pitch_strength: analysis.sales_pitch_strength,
    };
  },
});

export const searchVectorDatabaseTool = tool({
  name: 'search_vector_database',
  description:
    'Search the vector database for the most relevant training posts. This tool helps find examples of successful social media posts or newsletter snippets that teased a particular type of content, matching by content type, style, audience, and ownership.',
  inputSchema: z.object({
    // The main semantic query for the *teaser style*. This is what the user *wants* the generated teaser to sound like.
    query: z
      .string()
      .describe(
        'A semantic description of the desired teaser style, tone, or specific elements (e.g., "witty problem-solution hook," "direct call to action for developers"). This will be used to search against the teaser embeddings.'
      ),

    // Summary of the *user's linked content*. This is critical for finding training posts promoting similar content.
    content_summary_of_user_link: z
      .string()
      .describe(
        "A summary of the end-user's linked content (the article, course, etc. they want to promote). Used to find training posts promoting semantically similar content."
      ),

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
    call_to_action_type: z
      .enum(ctaTypeEnum.enumValues)
      .optional()
      .describe(
        'The type of action the teaser aims to prompt (e.g., "learn_more", "sign_up").'
      ),
    min_sales_pitch_strength: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Minimum desired sales pitch strength (1-10).'),
    max_sales_pitch_strength: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Maximum desired sales pitch strength (1-10).'),
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
    query,
    content_summary_of_user_link,
    link_type,
    platform,
    link_ownership_type,
    target_audience,
    call_to_action_type,
    min_sales_pitch_strength,
    max_sales_pitch_strength,
    desired_tone,
    limit = 5,
  }) => {
    try {
      // Step 1: Embed the user's content summary for content-based similarity
      const userContentSummaryEmbedding = await embed({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        value: content_summary_of_user_link,
      });

      // Step 2: Embed the stylistic query for teaser-style similarity
      const teaserStyleQueryEmbedding = await embed({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        value: query,
      });

      // Construct a dynamic query for Drizzle + vector DB
      let baseQuery = db.select().from(training_posts).$dynamic(); // Allows for dynamic WHERE clauses

      // --- Apply Filters ---
      let whereClauses = [];

      if (link_type) {
        whereClauses.push(eq(training_posts.content_type, link_type));
      }
      if (platform) {
        whereClauses.push(eq(training_posts.platform, platform));
      }
      if (link_ownership_type) {
        whereClauses.push(
          eq(training_posts.link_ownership_type, link_ownership_type)
        );
      }
      if (target_audience) {
        // Assuming target_audience is still a single enum value for now
        whereClauses.push(eq(training_posts.target_audience, target_audience));
      }
      if (call_to_action_type) {
        whereClauses.push(
          eq(training_posts.call_to_action_type, call_to_action_type)
        );
      }

      // Combine WHERE clauses
      if (whereClauses.length > 0) {
        baseQuery = baseQuery.where(and(...whereClauses));
      }

      // --- Vector Search for Content Similarity (Primary Retrieval) ---
      // This part depends on your specific vector DB integration (e.g., pgvector syntax)
      // Assuming 'vector' column has operators like '<=>' for cosine distance
      const contentSimilarPosts = await db
        .select()
        .from(training_posts)
        .where(
          and(
            // Apply other filters here as well
            ...whereClauses,
            sql`training_posts.content_summary_embedding <-> ${userContentSummaryEmbedding} < 0.2` // Example: threshold for content similarity
          )
        )
        .orderBy(
          sql`training_posts.content_summary_embedding <-> ${userContentSummaryEmbedding}`
        )
        .limit(limit * 2) // Retrieve more candidates for further refinement
        .execute();

      // --- Re-rank / Filter by Teaser Style Similarity and Desired Tone (Secondary Refinement) ---
      // For each candidate, calculate its teaser style similarity and factor in desired tone
      const rankedPosts = contentSimilarPosts
        .map((post) => {
          // Assuming a function that calculates similarity (e.g., dot product, cosine)
          const teaserStyleSimilarity = calculateCosineSimilarity(
            teaserStyleQueryEmbedding.embedding,
            post.embedding ?? []
          );

          // Factor in desired tone: Boost score if the desired_tone is present in tone_profile
          let toneBoost = 0;
          if (desired_tone && post.tone_profile) {
            const toneEntry = post.tone_profile.find(
              (t) => t.tone === desired_tone
            );
            if (toneEntry) {
              toneBoost = toneEntry.weight / 100; // Normalize weight for boost (e.g., max 1.0)
            }
          }

          // Combine similarities and boost for a final relevance score
          // You'll need to fine-tune this scoring function
          const totalRelevanceScore =
            teaserStyleSimilarity * 0.7 + toneBoost * 0.3; // Example weighting

          return { ...post, totalRelevanceScore };
        })
        .sort((a, b) => b.totalRelevanceScore - a.totalRelevanceScore) // Sort descending
        .slice(0, limit); // Take the top 'limit' posts

      // IMPORTANT: Sanitize output before returning to LLM
      // We only want to return the relevant textual content and explicit hooks
      const sanitizedResults = rankedPosts.map((post) => ({
        post_content: post.post_content,
        // You can add other relevant metadata for the LLM if it helps it understand the example
        // e.g., tone_profile, content_summary of the example post
        content_summary: post.content_summary, // Summary of the *example's* linked content
        // This gives the LLM context about what the example post was selling
        platform: post.platform,
        link_ownership_type: post.link_ownership_type,
        // ... etc.
      }));

      if (sanitizedResults.length === 0) {
        return {
          results: [],
          message:
            'No relevant training posts found matching the criteria. Try broadening your query or filters.',
        };
      }

      return {
        results: sanitizedResults,
        message: 'Successfully retrieved relevant training posts.',
      };
    } catch (error) {
      console.error('Error searching vector database:', error);
      return {
        results: [],
        message: `An error occurred: ${getErrorMessage(error)}`,
      };
    }
  },
});

// Dummy function for cosine similarity - replace with your actual implementation
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0; // Or throw error
  }
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  return dotProduct / (magnitude1 * magnitude2);
}
