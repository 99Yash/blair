import { headers } from 'next/headers';

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '~/db';
import { generate_posts } from '~/db/schemas';
import { teaserGenerationAgent } from '~/lib/ai/agents';
import { auth } from '~/lib/auth/server';
import { postFormSchema } from '~/lib/schemas/post';
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

    // --- Agent Orchestration ---
    // The agent will decide to call scrape_website, then search_vector_database,
    // and then formulate the final social media post.
    const { experimental_output: agentOutput } =
      await teaserGenerationAgent.generate({
        // The prompt to the agent, providing all necessary user input
        prompt: `Generate a social media post for the user's provided link.
               User's URL: ${validatedBody.original_url}
               Target Platform: ${validatedBody.platform}
               Link Ownership: ${validatedBody.link_ownership_type}
               
               User's explicit preferences for the generated post (use these if suitable, otherwise infer from content):
               Desired Content Type: ${validatedBody.content_type || 'any'}
               Desired Target Audience: ${
                 validatedBody.target_audience || 'any'
               }
               Desired Tone Profile: ${JSON.stringify(
                 validatedBody.tone_profile
               )}
               Desired Call to Action: ${
                 validatedBody.call_to_action_type || 'any'
               }
               Desired Sales Pitch Strength: ${
                 validatedBody.sales_pitch_strength || 'any'
               }/10
               
               Your task is to:
               1. Scrape and analyze the content at the provided URL.
               2. Use the analysis and user preferences to find relevant training posts from the vector database.
               3. Generate an engaging social media post (or thread if appropriate for platform) based on the user's link, inferred content details, and the retrieved examples.
               4. Ensure the output strictly follows the defined output schema.`,
      });

    // Extract values from the agent's structured output
    const generatedPostText = agentOutput.generated_post_content;
    const contentSummary = agentOutput.content_summary_of_link;
    const inferredContentType = agentOutput.inferred_content_type;
    const inferredTargetAudience = agentOutput.inferred_target_audience;
    // You could store the inferred tone_profile, cta, sales_pitch_strength as well if your generate_posts schema allows for it.

    // --- Store the generated post ---
    await db.insert(generate_posts).values({
      original_url: validatedBody.original_url,
      post_content: generatedPostText,
      platform: validatedBody.platform,
      content_type: inferredContentType, // Use inferred type
      content_summary: contentSummary, // Store the scraped summary
      link_ownership_type: validatedBody.link_ownership_type,
      target_audience: inferredTargetAudience, // Use inferred audience
      user_id: session.user.id,
    });

    return NextResponse.json(
      { message: 'Post created successfully', generatedPostText },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error generating post:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
