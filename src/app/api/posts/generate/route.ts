import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { headers } from 'next/headers';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post';
import { getErrorMessage } from '~/lib/utils';

const POST_CONTENT_MAX_LENGTH = 100000;

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
        message: 'Validation error',
        errors: getErrorMessage(parseResult.error),
      },
      { status: 400 }
    );
  }
  const validatedBody = parseResult.data;

  try {
    // Check if user already has a post with this URL
    const existingPost = await db
      .select()
      .from(generate_posts)
      .where(
        and(
          eq(generate_posts.original_url, validatedBody.original_url),
          eq(generate_posts.user_id, session.user.id)
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
    const slicedContent = content.slice(0, POST_CONTENT_MAX_LENGTH);

    const { object: analysis } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: scrapedContentAnalysisSchema,
      prompt: `Analyze the following scraped content: ${slicedContent} and return the analysis in the schema provided.`,
    });

    await db.insert(generate_posts).values({
      original_url: validatedBody.original_url,
      post_content: scrapedContent.markdown ?? '',
      platform: validatedBody.platform,
      content_type: validatedBody.content_type,
      content_summary: analysis.content_summary,
      link_ownership_type: validatedBody.link_ownership_type,
      target_audience: validatedBody.target_audience,
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
