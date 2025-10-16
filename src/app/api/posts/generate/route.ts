import { generateObject } from 'ai';
import { headers } from 'next/headers';

import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as z from 'zod/v4';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { auth } from '~/lib/auth/server';
import { firecrawl } from '~/lib/firecrawl';
import {
  postFormSchema,
  scrapedContentAnalysisSchema,
} from '~/lib/schemas/post';
import { getErrorMessage } from '~/lib/utils';

// Create a modified schema for the generate endpoint that doesn't require generated fields
const generatePostSchema = postFormSchema.omit({
  post_content: true,
  content_summary: true,
});

export async function POST(request: Request) {
  console.log('=== POST /api/posts/generate ===');

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  console.log('Session:', {
    hasSession: !!session?.user,
    userId: session?.user?.id,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
  });

  if (!session?.user) {
    console.log('ERROR: No valid session');
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.log('ERROR: Failed to parse request body:', error);
    return NextResponse.json(
      { message: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  console.log('Validating against generatePostSchema...');
  const parseResult = generatePostSchema.safeParse(body);

  console.log('Validation result:', {
    success: parseResult.success,
    hasError: !parseResult.success,
  });

  if (!parseResult.success) {
    console.log(
      'VALIDATION ERRORS:',
      JSON.stringify(parseResult.error.issues, null, 2)
    );
    console.log('Error message:', getErrorMessage(parseResult.error));
    return NextResponse.json(
      {
        message: 'Validation error',
        errors: getErrorMessage(parseResult.error),
        debug: parseResult.error.issues,
      },
      { status: 400 }
    );
  }

  console.log('Validation successful!');
  const validatedBody = parseResult.data;
  console.log('Validated body:', JSON.stringify(validatedBody, null, 2));

  // Ensure tone_profile is always provided for the API expectations
  const submissionData = {
    ...validatedBody,
    tone_profile:
      validatedBody.tone_profile && validatedBody.tone_profile.length > 0
        ? validatedBody.tone_profile
        : [{ tone: 'casual' as const, weight: 50 }], // Default tone if none specified
  };

  try {
    // Check if user already has a post with this URL
    console.log('Checking for existing posts...');
    console.log('URL to check:', submissionData.original_url);
    console.log('User ID:', session.user.id);

    const existingPost = await db
      .select()
      .from(generate_posts)
      .where(
        and(
          eq(generate_posts.original_url, submissionData.original_url),
          eq(generate_posts.user_id, session.user.id)
        )
      )
      .limit(1);

    console.log('Existing posts found:', existingPost.length);

    if (existingPost.length > 0) {
      console.log('ERROR: URL already exists for this user');
      return NextResponse.json(
        { message: 'You have already added this URL' },
        { status: 409 }
      );
    }

    console.log('No existing posts found, proceeding with generation...');

    // --- Step 1: Scrape and analyze the website content ---
    console.log('Scraping website content...');
    const scrapedContent = await firecrawl.scrape(submissionData.original_url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 1000,
    });

    const content = scrapedContent.markdown ?? scrapedContent.html ?? '';
    const slicedContent = content.slice(0, 100000);

    const { openai } = await import('@ai-sdk/openai');
    const { object: analysis } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: scrapedContentAnalysisSchema,
      prompt: `Analyze the following scraped content: ${slicedContent} and return the analysis in the schema provided.`,
    });

    if (!analysis || !analysis.content_summary) {
      console.log('ERROR: Failed to analyze website content');
      return NextResponse.json(
        { message: 'Failed to analyze website content' },
        { status: 500 }
      );
    }

    const contentSummary = analysis.content_summary;
    const inferredContentType = analysis.content_type;
    const inferredTargetAudience = analysis.target_audience;

    console.log('Scraping completed:', {
      contentSummaryLength: contentSummary?.length || 0,
      inferredContentType,
      inferredTargetAudience,
    });

    // --- Step 2: Search for relevant training posts ---
    console.log('Searching for relevant training posts...');

    // Import training posts schema
    const { training_posts } = await import('~/db/schemas/training-post');

    // Build dynamic where clauses for exact matches first
    const exactMatchClauses = [];

    if (submissionData.platform) {
      exactMatchClauses.push(
        eq(training_posts.platform, submissionData.platform)
      );
    }
    if (submissionData.content_type || inferredContentType) {
      exactMatchClauses.push(
        eq(
          training_posts.content_type,
          submissionData.content_type || inferredContentType
        )
      );
    }
    if (submissionData.link_ownership_type) {
      exactMatchClauses.push(
        eq(
          training_posts.link_ownership_type,
          submissionData.link_ownership_type
        )
      );
    }
    if (submissionData.target_audience || inferredTargetAudience) {
      exactMatchClauses.push(
        eq(
          training_posts.target_audience,
          submissionData.target_audience || inferredTargetAudience
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

    // Sales pitch strength filter
    if (submissionData.sales_pitch_strength) {
      const minStrength = Math.max(1, submissionData.sales_pitch_strength - 2);
      const maxStrength = Math.min(10, submissionData.sales_pitch_strength + 2);
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
        .limit(5);

      results = await exactMatchQuery;
    }

    // If no exact matches found, try broader search
    if (results.length === 0 && exactMatchClauses.length > 0) {
      // Try with fewer filters - prioritize the most important ones
      const priorityFilters = [];
      if (submissionData.platform)
        priorityFilters.push(
          eq(training_posts.platform, submissionData.platform)
        );
      if (submissionData.content_type || inferredContentType)
        priorityFilters.push(
          eq(
            training_posts.content_type,
            submissionData.content_type || inferredContentType
          )
        );

      if (priorityFilters.length > 0) {
        const priorityQuery = db
          .select()
          .from(training_posts)
          .where(and(...priorityFilters))
          .limit(5);
        results = await priorityQuery;
      }

      // If still no results, just get some recent posts as fallback
      if (results.length === 0) {
        const fallbackQuery = db
          .select()
          .from(training_posts)
          .orderBy(sql`${training_posts.createdAt} DESC`)
          .limit(5);
        results = await fallbackQuery;
      }
    }

    console.log('Search completed:', {
      resultsFound: results.length || 0,
    });

    // --- Step 3: Generate the post content ---
    console.log('Generating post content...');

    const { object: generatedContent } = await generateObject({
      model: openai('gpt-4o'),
      schema: z.object({
        generated_post_content: z
          .string()
          .describe('The full generated social media post content.'),
      }),
      prompt: `Generate a social media post for the following link.

URL: ${submissionData.original_url}
Platform: ${submissionData.platform}
Link Ownership: ${submissionData.link_ownership_type}

Content Analysis:
- Summary: ${contentSummary}
- Content Type: ${inferredContentType}
- Target Audience: ${inferredTargetAudience}

User Preferences:
- Tone Profile: ${JSON.stringify(submissionData.tone_profile)}
- Call to Action: ${submissionData.call_to_action_type || 'any'}
- Sales Pitch Strength: ${submissionData.sales_pitch_strength || 'medium'}/10

${
  results && results.length > 0
    ? `
Example Posts:
${results
  .map(
    (post: typeof training_posts.$inferSelect, index: number) => `
Example ${index + 1}:
Content: ${post.post_content}
Platform: ${post.platform}
Content Type: ${post.content_type}
Target Audience: ${post.target_audience}
Tone: ${post.tone_profile ? JSON.stringify(post.tone_profile) : 'Not specified'}
`
  )
  .join('\n')}
`
    : 'No example posts found.'
}

Generate an engaging social media post that promotes this link effectively. Make sure the tone matches the user's preferences and follows best practices for the specified platform.`,
    });

    const generatedPostText = generatedContent.generated_post_content;

    if (!generatedPostText) {
      console.log('ERROR: Failed to generate post content');
      return NextResponse.json(
        { message: 'Failed to generate post content' },
        { status: 500 }
      );
    }

    console.log('Generation completed:', {
      generatedPostTextLength: generatedPostText.length,
    });

    // --- Store the generated post ---
    console.log('Storing post in database...');
    const insertData = {
      original_url: submissionData.original_url,
      post_content: generatedPostText,
      platform: submissionData.platform,
      content_type: inferredContentType as
        | 'self_help'
        | 'tech_tutorial'
        | 'news_article'
        | 'product_review'
        | 'thought_leadership'
        | 'entertainment'
        | 'other',
      content_summary: contentSummary || '',
      link_ownership_type: submissionData.link_ownership_type,
      target_audience: inferredTargetAudience as
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

    console.log('Insert data:', JSON.stringify(insertData, null, 2));

    const insertResult = await db.insert(generate_posts).values(insertData);
    console.log('Database insert result:', insertResult);

    console.log('SUCCESS: Post created successfully!');
    return NextResponse.json(
      { message: 'Post created successfully', generatedPostText },
      { status: 201 }
    );
  } catch (error) {
    console.error('ERROR: Exception during post generation:', error);
    console.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    );
    return NextResponse.json(
      { message: 'Internal Server Error', error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
