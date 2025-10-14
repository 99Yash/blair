import { openai } from '@ai-sdk/openai';
import { embedMany, generateObject } from 'ai';
import { headers } from 'next/headers';

import { db } from '~/db';
import { training_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post-form';

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();

  let validatedBody;
  try {
    validatedBody = postFormSchema.parse(body);
  } catch (error) {
    // ZodError or generic error
    const message =
      error?.issues
        ? JSON.stringify(error.issues)
        : error?.message || 'Invalid request body';
    return new Response(`Validation Error: ${message}`, { status: 400 });
  }

  try {
    const scrapedContent = await firecrawl.scrape(validatedBody.original_url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 1000,
    });

    const content = scrapedContent.markdown ?? scrapedContent.html ?? '';
    const slicedContent = content.slice(0, 100000);

    console.log('scrapedContent', scrapedContent);

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

    console.log('Generated embeddings:', {
      postContentLength: (scrapedContent.markdown ?? '').length,
      summaryLength: analysis.content_summary.length,
      embeddingDimensions: embeddings[0]?.length,
    });

    const [post] = await db
      .insert(training_posts)
      .values({
        original_url: validatedBody.original_url,
        post_content: scrapedContent.markdown ?? '',
        platform: validatedBody.platform,
        content_type: validatedBody.content_type,
        content_summary: analysis.content_summary,
        call_to_action_type: analysis.call_to_action_type,
        sales_pitch_strength: analysis.sales_pitch_strength,
        tone_profile: analysis.tone_profile,
        link_ownership_type: validatedBody.link_ownership_type,
        target_audience: validatedBody.target_audience,
        user_id: session.user.id,
        embedding: embeddings[0],
        content_summary_embedding: embeddings[1],
      })
      .returning();

    console.log('post', post);

    return new Response('Post created successfully', { status: 201 });
  } catch (error) {
    console.error('Error scraping and analyzing URL:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
