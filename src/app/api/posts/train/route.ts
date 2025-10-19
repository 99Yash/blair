import { openai } from '@ai-sdk/openai';
import { embedMany, generateObject } from 'ai';
import { headers } from 'next/headers';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { training_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { SCRAPED_POST_CONTENT_MAX_LENGTH } from '~/lib/constants';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post';
import { getErrorMessage } from '~/lib/utils';

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const parseResult = postFormSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        message: getErrorMessage(parseResult.error),
      },
      { status: 400 }
    );
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
      return NextResponse.json(
        { message: 'You have already added this URL' },
        { status: 409 }
      );
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
      platform: validatedBody.platform,
      content_type: analysis.content_type,
      content_summary: analysis.content_summary,
      call_to_action_type: analysis.call_to_action_type ?? 'other',
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
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
