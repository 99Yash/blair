import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  streamText,
} from 'ai';
import { headers } from 'next/headers';

import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post';
import {
  createContentAnalysisData,
  createGeneratedPostData,
  createNotificationData,
  createProgressData,
  createTrainingPostsData,
  PROGRESS_STAGES,
  StreamingPostMessage,
} from '~/lib/types/streaming';
import { getErrorMessage } from '~/lib/utils';

// Create a modified schema for the generate endpoint that doesn't require generated fields
const generatePostSchema = postFormSchema.omit({
  post_content: true,
  content_summary: true,
});

export async function POST(request: Request) {
  console.log('=== POST /api/posts/generate (Streaming) ===');

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const parseResult = generatePostSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        message: 'Validation error',
        errors: getErrorMessage(parseResult.error),
      },
      { status: 400 }
    );
  }

  const validatedBody = parseResult.data;

  // Ensure tone_profile is always provided for the API expectations
  const submissionData = {
    ...validatedBody,
    tone_profile:
      validatedBody.tone_profile && validatedBody.tone_profile.length > 0
        ? validatedBody.tone_profile
        : [{ tone: 'casual' as const, weight: 50 }],
  };

  // Create a custom stream that integrates better with useChat
  // We'll send progress updates and final result
  const stream = createUIMessageStream<StreamingPostMessage>({
    execute: async ({ writer }) => {
      try {
        // Send initial progress
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SCRAPING,
            'Starting post generation...',
            'loading'
          )
        );

        // Note: We removed the existence check to avoid race conditions.
        // Unique constraint violations will be handled below.

        // Step 1: Scrape and analyze content
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SCRAPING,
            'Scraping website content...',
            'loading',
            submissionData.original_url
          )
        );

        const scrapedContent = await firecrawl.scrape(
          submissionData.original_url,
          {
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            waitFor: 1000,
          }
        );

        const content = scrapedContent.markdown ?? scrapedContent.html ?? '';
        const slicedContent = content.slice(0, 100000);

        writer.write(
          createProgressData(
            PROGRESS_STAGES.ANALYZING,
            'Analyzing scraped content...',
            'loading'
          )
        );

        const { object: analysis } = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: scrapedContentAnalysisSchema,
          prompt: `Analyze the following scraped content and provide the analysis in the exact format specified by the schema. Return only the object data that matches the schema properties:

${slicedContent}

Return an object with these exact fields:
- content_summary: string (summary of the content)
- content_type: one of the enum values
- target_audience: one of the enum values
- tone_profile: array of tone objects with tone and weight
- call_to_action_type: one of the enum values
- sales_pitch_strength: number 0-100`,
        });

        if (!analysis || !analysis.content_summary) {
          writer.write(
            createProgressData(
              PROGRESS_STAGES.ANALYZING,
              'Failed to analyze website content',
              'error'
            )
          );
          writer.write(
            createNotificationData('Failed to analyze website content', 'error')
          );
          return;
        }

        // Send content analysis results
        writer.write(
          createProgressData(
            PROGRESS_STAGES.ANALYZING,
            'Content analysis completed',
            'success'
          )
        );
        writer.write(
          createContentAnalysisData({
            content_summary: analysis.content_summary,
            content_type: analysis.content_type,
            target_audience: analysis.target_audience,
            tone_profile: analysis.tone_profile,
            call_to_action_type: analysis.call_to_action_type,
            sales_pitch_strength: analysis.sales_pitch_strength,
          })
        );

        // Step 2: Search for training posts
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SEARCHING,
            'Searching for similar posts...',
            'loading'
          )
        );

        const { training_posts } = await import('~/db/schemas/training-post');

        const exactMatchClauses = [];
        if (submissionData.platform) {
          exactMatchClauses.push(
            eq(training_posts.platform, submissionData.platform)
          );
        }
        if (submissionData.content_type || analysis.content_type) {
          exactMatchClauses.push(
            eq(
              training_posts.content_type,
              submissionData.content_type || analysis.content_type
            )
          );
        }
        if (submissionData.target_audience || analysis.target_audience) {
          exactMatchClauses.push(
            eq(
              training_posts.target_audience,
              submissionData.target_audience || analysis.target_audience
            )
          );
        }
        if (submissionData.call_to_action_type) {
          exactMatchClauses.push(
            eq(
              training_posts.call_to_action_type,
              submissionData.call_to_action_type
            )
          );
        }

        let results: (typeof training_posts.$inferSelect)[] = [];
        if (exactMatchClauses.length > 0) {
          const query = db
            .select()
            .from(training_posts)
            .where(and(...exactMatchClauses))
            .limit(5);
          results = await query;
        }

        if (results.length === 0 && exactMatchClauses.length > 0) {
          const priorityFilters = [];
          if (submissionData.platform)
            priorityFilters.push(
              eq(training_posts.platform, submissionData.platform)
            );
          if (submissionData.content_type || analysis.content_type) {
            priorityFilters.push(
              eq(
                training_posts.content_type,
                submissionData.content_type || analysis.content_type
              )
            );
          }

          if (priorityFilters.length > 0) {
            const query = db
              .select()
              .from(training_posts)
              .where(and(...priorityFilters))
              .limit(5);
            results = await query;
          }

          if (results.length === 0) {
            const fallbackQuery = db
              .select()
              .from(training_posts)
              .orderBy(sql`${training_posts.createdAt} DESC`)
              .limit(5);
            results = await fallbackQuery;
          }
        }

        const examplePosts = results.slice(0, 3).map((post) => ({
          content: post.post_content,
          platform: post.platform,
          content_type: post.content_type,
        }));

        writer.write(
          createProgressData(
            PROGRESS_STAGES.SEARCHING,
            `Found ${results.length} similar posts`,
            'success'
          )
        );
        writer.write(createTrainingPostsData(results.length, examplePosts));

        // Step 3: Generate post content
        writer.write(
          createProgressData(
            PROGRESS_STAGES.GENERATING,
            'Generating post content...',
            'loading'
          )
        );

        // Use streamText for the actual content generation
        const generationResult = streamText({
          model: openai('gpt-4o'),
          messages: [
            {
              role: 'user',
              content: `Generate a social media post for the following link. Don't use redundant emojis.

URL: ${submissionData.original_url}
Platform: ${submissionData.platform}
Link Ownership: ${submissionData.link_ownership_type}

Content Analysis:
- Summary: ${analysis.content_summary}
- Content Type: ${analysis.content_type}
- Target Audience: ${analysis.target_audience}

User Preferences:
- Tone Profile: ${JSON.stringify(submissionData.tone_profile)}
- Call to Action: ${submissionData.call_to_action_type || 'any'}
- Sales Pitch Strength: ${submissionData.sales_pitch_strength || 'medium'}/10

${
  examplePosts.length > 0
    ? `
Example Posts:
${examplePosts
  .map(
    (post, index) => `
Example ${index + 1}:
Content: ${post.content}
Platform: ${post.platform}
Content Type: ${post.content_type}`
  )
  .join('\n')}
`
    : 'No example posts found.'
}

Generate an engaging social media post that promotes this link effectively. Make sure the tone matches the user's preferences and follows best practices for the specified platform.`,
            },
          ],
        });

        // Collect the generated content
        let generatedContent = '';
        for await (const delta of generationResult.textStream) {
          generatedContent += delta;
          // Send incremental updates as content is generated
          if (generatedContent.length % 50 === 0) {
            // Update every 50 characters
            writer.write(
              createProgressData(
                PROGRESS_STAGES.GENERATING,
                `Generating post content... (${generatedContent.length} characters)`,
                'loading'
              )
            );
          }
        }

        if (!generatedContent) {
          writer.write(
            createProgressData(
              PROGRESS_STAGES.GENERATING,
              'Failed to generate post content',
              'error'
            )
          );
          writer.write(
            createNotificationData('Failed to generate post content', 'error')
          );
          return;
        }

        writer.write(
          createProgressData(
            PROGRESS_STAGES.GENERATING,
            'Post content generated successfully',
            'success'
          )
        );

        // Step 4: Save to database
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SAVING,
            'Saving post to database...',
            'loading'
          )
        );

        const insertData = {
          original_url: submissionData.original_url,
          post_content: generatedContent,
          platform: submissionData.platform,
          content_type: analysis.content_type as
            | 'self_help'
            | 'tech_tutorial'
            | 'news_article'
            | 'product_review'
            | 'thought_leadership'
            | 'entertainment'
            | 'other',
          content_summary: analysis.content_summary || '',
          target_audience: analysis.target_audience as
            | 'developers'
            | 'marketers'
            | 'entrepreneurs'
            | 'students'
            | 'parents'
            | 'general_public'
            | 'creatives'
            | 'finance_professionals'
            | 'other',
          user_id: session.user.id,
        };

        try {
          await db.insert(generate_posts).values(insertData);

          writer.write(
            createProgressData(
              PROGRESS_STAGES.SAVING,
              'Post saved successfully',
              'success'
            )
          );

          // Send final result as a data message that useChat can handle
          writer.write(
            createGeneratedPostData(generatedContent, submissionData.platform)
          );

          writer.write(
            createNotificationData(
              'Post generation completed successfully!',
              'success'
            )
          );
        } catch (error: any) {
          // Handle unique constraint violation
          if (
            error?.code === '23505' ||
            error?.message?.includes('unique constraint')
          ) {
            writer.write(
              createProgressData(
                PROGRESS_STAGES.SAVING,
                'URL already exists for this user',
                'error'
              )
            );
            writer.write(
              createNotificationData('You have already added this URL', 'error')
            );
            return;
          }

          // Re-throw other errors to be handled by the outer catch
          throw error;
        }
      } catch (err) {
        console.error('ERROR: Exception during post generation:', err);
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SAVING,
            'An error occurred during generation',
            'error'
          )
        );
        writer.write(
          createNotificationData('Internal server error occurred', 'error')
        );
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
