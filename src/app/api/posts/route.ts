import { openai } from '@ai-sdk/openai';
import { embed, generateObject } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '~/db';
import { training_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { scrapeUrl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post-form';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();

    // Check if this is a scraping request (only URL provided)
    if (body.original_url && Object.keys(body).length === 1) {
      const url = body.original_url;

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }

      // Scrape the URL content
      const scrapedContent = await scrapeUrl(url);

      if (!scrapedContent.markdown) {
        return NextResponse.json(
          { error: 'No content could be extracted from the URL' },
          { status: 400 }
        );
      }

      // Use AI to analyze the scraped content and generate form data
      const { object: analyzedData } = await generateObject({
        model: openai('gpt-4o-mini'),
        schema: scrapedContentAnalysisSchema,
        prompt: `Analyze this scraped web content and provide detailed information for social media post creation:

Scraped Content:
Title: ${scrapedContent.title || 'No title available'}
Description: ${scrapedContent.description || 'No description available'}

Full Content (first 4000 characters for analysis):
${scrapedContent.markdown.substring(0, 4000)}${
          scrapedContent.markdown.length > 4000 ? '...' : ''
        }

Please analyze this content and infer:
1. A concise summary of the content (2-3 sentences max)
2. The content type/category (self_help, tech_tutorial, news_article, product_review, thought_leadership, entertainment, other)
3. The target audience most likely to engage with this content (developers, marketers, entrepreneurs, students, parents, general_public, creatives, finance_professionals, other)
4. The primary tone(s) used in the writing (provide 1-3 tones with weights that sum to 100)
5. The most appropriate call-to-action type based on the content (learn_more, sign_up, buy_now, read_article, watch_video, download, join_community, poll_question, other)

Focus on the actual content and provide accurate, helpful analysis for social media marketing purposes.`,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      // Return the analyzed data that can be used to populate the form
      return NextResponse.json({
        success: true,
        data: {
          original_url: url,
          content_summary: analyzedData.content_summary,
          content_type: analyzedData.content_type,
          target_audience: analyzedData.target_audience,
          tone_profile: analyzedData.tone_profile,
          call_to_action_type: analyzedData.call_to_action_type,
          scraped_metadata: {
            title: scrapedContent.title,
            description: scrapedContent.description,
          },
        },
      });
    }

    // This is a post creation request - validate the complete form data
    const validatedData = postFormSchema.parse(body);

    // Generate embeddings using AI SDK
    const [postEmbedding, summaryEmbedding] = await Promise.all([
      embed({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        value: validatedData.post_content,
      }),
      embed({
        model: openai.textEmbeddingModel('text-embedding-3-small'),
        value: validatedData.content_summary,
      }),
    ]);

    // Prepare data for database insertion
    const postData = {
      post_content: validatedData.post_content,
      platform: validatedData.platform,
      content_type: validatedData.content_type,
      original_url: validatedData.original_url,
      content_summary: validatedData.content_summary,
      call_to_action_type: validatedData.call_to_action_type,
      sales_pitch_strength: validatedData.sales_pitch_strength,
      tone_profile: validatedData.tone_profile,
      embedding: postEmbedding.embedding,
      content_summary_embedding: summaryEmbedding.embedding,
      link_ownership_type: validatedData.link_ownership_type,
      target_audience: validatedData.target_audience,
      user_id: session.user.id,
    };

    // Save to database
    const result = await db.insert(training_posts).values(postData).returning();

    return NextResponse.json({
      success: true,
      data: result[0],
      usage: {
        postTokens: postEmbedding.usage?.tokens || 0,
        summaryTokens: summaryEmbedding.usage?.tokens || 0,
      },
    });
  } catch (error) {
    console.error('Error creating post:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
