import { openai } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  streamText,
} from 'ai';
import { headers } from 'next/headers';

import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { createPrompt } from '~/lib/ai/utils';
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
        errors: parseResult.error.issues.map((issue) => issue.message),
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
        : [{ tone: 'casual', weight: 50 }],
  };

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

        // Step 2: Search for training posts using tone similarity
        currentStage = PROGRESS_STAGES.SEARCHING;
        writer.write(
          createProgressData(
            PROGRESS_STAGES.SEARCHING,
            'Searching for tone-similar posts...',
            'loading'
          )
        );

        // We'll use analysis.tone_profile (from content analysis) if available,
        // otherwise fallback to submissionData.tone_profile.
        const toneProfile =
          analysis.tone_profile ?? submissionData.tone_profile;

        // Convert toneProfile to JSON so we can use it inside SQL
        const toneProfileJson = JSON.stringify(toneProfile);

        const toneSimilaritySql = sql`
          SELECT
            tp.*,
            (
              SELECT SUM(
                CASE
                  WHEN ABS((tone_elem->>'weight')::int - ut.weight) <= 10 THEN 1
                  ELSE 0
                END
              )
              FROM jsonb_array_elements(tp.tone_profile) AS tone_elem
              JOIN jsonb_to_recordset(${toneProfileJson}::jsonb) AS ut(tone text, weight int)
                ON (tone_elem->>'tone') = ut.tone
            ) AS tone_match_score
          FROM training_posts tp
          WHERE 1=1
        `;

        // Add existing exact match filters as additional criteria
        if (submissionData.platform) {
          toneSimilaritySql.append(
            sql` AND tp.platforms = ${submissionData.platform}`
          );
        }
        if (submissionData.content_type || analysis.content_type) {
          toneSimilaritySql.append(
            sql` AND tp.content_type = ${
              submissionData.content_type ?? analysis.content_type
            }`
          );
        }
        if (submissionData.target_audience || analysis.target_audience) {
          toneSimilaritySql.append(
            sql` AND tp.target_audience = ${
              submissionData.target_audience ?? analysis.target_audience
            }`
          );
        }
        if (submissionData.call_to_action_type) {
          toneSimilaritySql.append(
            sql` AND tp.call_to_action_type = ${submissionData.call_to_action_type}`
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
${submissionData.tone_profile.map((t) => `${t.tone}: ${t.weight}`).join(', ')}`,
          backgroundData: `Link to promote: ${submissionData.original_url}
Link ownership: ${submissionData.link_ownership_type}
Content summary: ${analysis.content_summary}
Content type: ${analysis.content_type}
Target audience: ${analysis.target_audience}
Call to action: ${submissionData.call_to_action_type || 'any'}
Sales pitch strength: ${
            submissionData.sales_pitch_strength != null
              ? Math.round(submissionData.sales_pitch_strength / 10)
              : 'medium'
          }/10`,
          detailedTaskInstructions: `Follow best practices for ${submissionData.platform}. Avoid redundant emojis and keep it engaging. Use platform-appropriate phrasing.`,
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
          content_type: submissionData.content_type ?? analysis.content_type,
          content_summary: analysis.content_summary,
          target_audience:
            submissionData.target_audience ?? analysis.target_audience,
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
          // Narrow the unknown error to access optional `code` and `message` properties safely
          const dbError =
            typeof error === 'object' && error !== null
              ? (error as { code?: string; message?: string })
              : undefined;

          // Handle unique constraint violation
          if (
            dbError?.code === '23505' ||
            dbError?.message?.includes('unique constraint')
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
            currentStage,
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
