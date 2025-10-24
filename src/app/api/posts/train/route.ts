import { openai } from '@ai-sdk/openai';
import { embedMany, generateObject } from 'ai';
import { headers } from 'next/headers';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { training_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { SCRAPED_POST_CONTENT_MAX_LENGTH } from '~/lib/constants';
import { AppError, createErrorResponse } from '~/lib/errors';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post';
import {
  createAuthError,
  createConflictError,
  createDatabaseError,
  createExternalServiceError,
  createValidationError,
} from '~/lib/utils';

export async function POST(request: Request) {
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

  const parseResult = postFormSchema.safeParse(body);
  if (!parseResult.success) {
    const error = createValidationError(parseResult.error.issues);
    return NextResponse.json(createErrorResponse(error), {
      status: error.getStatusFromCode(),
    });
  }
  const validatedBody = parseResult.data;

  try {
    // Check if user already has a post with this URL
    const existingPost = await db
      .select()
      .from(training_posts)
      .where(
        and(
          eq(training_posts.original_url, validatedBody.original_url),
          eq(training_posts.user_id, session.user.id)
        )
      )
      .limit(1);

    if (existingPost.length > 0) {
      const error = createConflictError('You have already added this URL');
      return NextResponse.json(createErrorResponse(error), {
        status: error.getStatusFromCode(),
      });
    }

    const scrapedContent = await firecrawl.scrape(validatedBody.original_url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 1000,
    });

    const content = scrapedContent.markdown ?? scrapedContent.html ?? '';
    const slicedContent = content.slice(0, SCRAPED_POST_CONTENT_MAX_LENGTH);

    const { object: analysis } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: scrapedContentAnalysisSchema,
      prompt: `Analyze the following scraped content: ${slicedContent} and return the analysis in the schema provided.`,
    });

    // Generate embeddings for post content and content summary
    const { embeddings } = await embedMany({
      model: openai.textEmbeddingModel('text-embedding-3-small'),
      values: [
        scrapedContent.markdown ?? '', // post content embedding
        analysis.content_summary, // content summary embedding
      ],
    });

    await db.insert(training_posts).values({
      original_url: validatedBody.original_url,
      post_content: scrapedContent.markdown ?? '',
      platforms: validatedBody.platform,
      content_type: analysis.content_type,
      content_summary: analysis.content_summary,
      sales_pitch_strength: analysis.sales_pitch_strength,
      tone_profile: analysis.tone_profile,
      link_ownership_type: validatedBody.link_ownership_type,
      target_audience: analysis.target_audience,
      embedding: embeddings[0],
      content_summary_embedding: embeddings[1],
      user_id: session.user.id,
    });

    return NextResponse.json(
      { message: 'Post created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error scraping and analyzing URL:', error);

    // Determine specific error type based on the error message
    let appError: AppError;
    if (error instanceof Error) {
      if (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        appError = new AppError({
          code: 'TIMEOUT',
          message: 'Request timed out. Please try again.',
        });
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        appError = createExternalServiceError(
          'Network',
          'Network error occurred'
        );
      } else if (
        error.message.includes('rate limit') ||
        error.message.includes('429')
      ) {
        appError = new AppError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please wait a moment and try again.',
        });
      } else {
        appError = createDatabaseError(
          'Failed to process training post',
          error
        );
      }
    } else {
      appError = createDatabaseError();
    }

    return NextResponse.json(createErrorResponse(appError), {
      status: appError.getStatusFromCode(),
    });
  }
}
