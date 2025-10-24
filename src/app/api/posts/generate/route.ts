import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  streamText,
} from 'ai';
import { sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { createPrompt } from '~/lib/ai/utils';
import { auth } from '~/lib/auth/server';
import {
  PLATFORM_GENERATION_CONFIG,
  TONE_WEIGHT_SIMILARITY_THRESHOLD,
} from '~/lib/constants';
import { AppError, createErrorResponse } from '~/lib/errors';
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
import {
  createAuthError,
  createConflictError,
  createExternalServiceError,
  createValidationError,
} from '~/lib/utils';

// Schema for the generate endpoint - includes tone profile from user
const generatePostSchema = postFormSchema.pick({
  original_url: true,
  platform: true,
  link_ownership_type: true,
  tone_profile: true,
});

/**
 * Formats platform-specific instructions from the configuration
 */
function getPlatformInstructions(
  platform: keyof typeof PLATFORM_GENERATION_CONFIG
): string {
  const config = PLATFORM_GENERATION_CONFIG[platform];

  const bestPracticesList = config.bestPractices
    .map((practice) => `  • ${practice}`)
    .join('\n');

  return `Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)}

Best Practices:
${bestPracticesList}

Formatting Guidelines:
  • Character limit: ${config.characterLimit}
  • Preferred length: ${config.formatting.preferredLength}
  • Hashtag placement: ${config.formatting.hashtagPlacement}
  • URL handling: ${config.formatting.urlHandling}

Use the specified tone profile weights to guide your writing style.`;
}

export async function POST(request: Request) {
  console.log('=== POST /api/posts/generate (Streaming) ===');

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    const error = createAuthError();
    return NextResponse.json(createErrorResponse(error), {
      status: error.getStatusFromCode(),
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    const error = new AppError({
      code: 'BAD_REQUEST',
      message: 'Invalid JSON in request body',
    });
    return NextResponse.json(createErrorResponse(error), {
      status: error.getStatusFromCode(),
    });
  }

  const parseResult = generatePostSchema.safeParse(body);
  if (!parseResult.success) {
    const error = createValidationError(parseResult.error.issues);
    return NextResponse.json(createErrorResponse(error), {
      status: error.getStatusFromCode(),
    });
  }

  const submissionData = parseResult.data;

  // Create a custom stream that integrates better with useChat
  // We'll send progress updates and final result
  const stream = createUIMessageStream<StreamingPostMessage>({
    execute: async ({ writer }) => {
      // Track the stage we are currently in so we can surface accurate errors
      let currentStage: (typeof PROGRESS_STAGES)[keyof typeof PROGRESS_STAGES] =
        PROGRESS_STAGES.SCRAPING;
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
        currentStage = PROGRESS_STAGES.SCRAPING;
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

        currentStage = PROGRESS_STAGES.ANALYZING;
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
          prompt: `Analyze the following scraped content:
${slicedContent}`,
        });

        if (!analysis || !analysis.content_summary) {
          const error = createExternalServiceError(
            'OpenAI',
            'Failed to analyze website content'
          );
          writer.write(
            createProgressData(
              PROGRESS_STAGES.ANALYZING,
              error.message,
              'error'
            )
          );
          writer.write(createNotificationData(error.message, 'error'));
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
            sales_pitch_strength: analysis.sales_pitch_strength,
          })
        );

        // Step 2: Search for training posts using tone similarity
        currentStage = PROGRESS_STAGES.SEARCHING;
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SEARCHING,
            'Searching for tone-similar posts...',
            'loading'
          )
        );

        // Use the user-provided tone profile
        const toneProfile = submissionData.tone_profile;

        // Convert toneProfile to JSON so we can use it inside SQL
        const toneProfileJson = JSON.stringify(toneProfile);

        const toneSimilaritySql = sql`
          SELECT
            tp.*,
            (
              SELECT COALESCE(SUM(
                CASE
                  WHEN ABS((tone_elem->>'weight')::float8 - ut.weight) <= ${sql.param(
                    TONE_WEIGHT_SIMILARITY_THRESHOLD
                  )} THEN 1
                  ELSE 0
                END
              ), 0)
              FROM jsonb_array_elements(tp.tone_profile) AS tone_elem
              JOIN jsonb_to_recordset(${toneProfileJson}::jsonb) AS ut(tone text, weight float8)
                ON (tone_elem->>'tone') = ut.tone
            ) AS tone_match_score
          FROM training_posts tp
          WHERE 1=1
        `;

        // Add existing exact match filters as additional criteria using analysis results
        if (submissionData.platform) {
          toneSimilaritySql.append(
            sql` AND tp.platforms = ${submissionData.platform}`
          );
        }
        if (analysis.content_type) {
          toneSimilaritySql.append(
            sql` AND tp.content_type = ${analysis.content_type}`
          );
        }
        if (analysis.target_audience) {
          toneSimilaritySql.append(
            sql` AND tp.target_audience = ${analysis.target_audience}`
          );
        }

        toneSimilaritySql.append(sql`
          ORDER BY tone_match_score DESC
          LIMIT 3
        `);

        // Execute the query
        const results = await db.execute(toneSimilaritySql);

        // Map the results for streaming
        const examplePosts = results.rows.map((post) => ({
          content: String(post.post_content ?? ''),
          platform: String(post.platforms ?? ''),
          content_type: String(post.content_type ?? ''),
        }));

        writer.write(
          createProgressData(
            PROGRESS_STAGES.SEARCHING,
            `Found ${
              results.rowCount ?? results.rows.length
            } tone-similar posts`,
            'success'
          )
        );
        writer.write(
          createTrainingPostsData(results.rows.length, examplePosts)
        );

        // Step 3: Generate post content
        currentStage = PROGRESS_STAGES.GENERATING;
        writer.write(
          createProgressData(
            PROGRESS_STAGES.GENERATING,
            'Generating post content...',
            'loading'
          )
        );

        const examples = examplePosts.length
          ? examplePosts
              .map(
                (post, i) => `Example ${i + 1}:
Platform: ${post.platform}
Content Type: ${post.content_type}
Content:
${post.content}`
              )
              .join('\n\n')
          : 'No example posts found.';

        const prompt = createPrompt({
          taskContext: `You are a professional social media copywriter generating posts for multiple platforms.`,
          toneContext: `Match the following tone profile (weight out of 100):
${toneProfile.map((t) => `${t.tone}: ${t.weight}`).join(', ')}`,
          backgroundData: `Link to promote: ${submissionData.original_url}
Link ownership: ${submissionData.link_ownership_type}
Content summary: ${analysis.content_summary}
Content type: ${analysis.content_type}
Target audience: ${analysis.target_audience}
Sales pitch strength: ${Math.round(analysis.sales_pitch_strength / 10)}/10`,
          detailedTaskInstructions: getPlatformInstructions(
            submissionData.platform
          ),
          examples,
          finalRequest: `Write a ${submissionData.platform} post that effectively promotes the link above, in the specified tone and voice.`,
          outputFormatting: `Reply with the post content only, no explanations.`,
        });

        const generationResult = streamText({
          model: openai('gpt-4o-mini'),
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // Collect the generated content and stream it to the client
        let generatedContent = '';
        for await (const delta of generationResult.textStream) {
          generatedContent += delta;

          // Stream the content as it's being generated (send every chunk)
          writer.write(
            createGeneratedPostData(generatedContent, submissionData.platform)
          );

          // Also update progress every 50 characters
          if (generatedContent.length % 50 === 0) {
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
        currentStage = PROGRESS_STAGES.SAVING;
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
          content_type: analysis.content_type,
          content_summary: analysis.content_summary,
          target_audience: analysis.target_audience,
          link_ownership_type: submissionData.link_ownership_type,
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

          // Note: Generated post data is already streamed during generation
          // No need to send it again here

          writer.write(
            createNotificationData(
              'Post generation completed successfully!',
              'success'
            )
          );
        } catch (error) {
          // Handle unique constraint violation
          const dbError =
            typeof error === 'object' && error !== null
              ? (error as { code?: string; message?: string })
              : undefined;

          if (
            dbError?.code === '23505' ||
            dbError?.message?.includes('unique constraint')
          ) {
            const conflictError = createConflictError(
              'You have already added this URL',
              error
            );
            writer.write(
              createProgressData(
                PROGRESS_STAGES.SAVING,
                conflictError.message,
                'error'
              )
            );
            writer.write(
              createNotificationData(conflictError.message, 'error')
            );
            return;
          }

          // Re-throw other errors to be handled by the outer catch
          throw error;
        }
      } catch (err) {
        console.error('ERROR: Exception during post generation:', err);

        // Determine error type and create appropriate error message
        let errorMessage = 'Internal server error occurred';
        if (err instanceof Error) {
          if (
            err.message.includes('timeout') ||
            err.message.includes('ETIMEDOUT')
          ) {
            errorMessage = 'Request timed out. Please try again.';
          } else if (
            err.message.includes('network') ||
            err.message.includes('ECONNREFUSED')
          ) {
            errorMessage =
              'Network error occurred. Please check your connection and try again.';
          } else if (
            err.message.includes('rate limit') ||
            err.message.includes('429')
          ) {
            errorMessage =
              'Rate limit exceeded. Please wait a moment and try again.';
          }
        }

        writer.write(createProgressData(currentStage, errorMessage, 'error'));
        writer.write(createNotificationData(errorMessage, 'error'));
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
