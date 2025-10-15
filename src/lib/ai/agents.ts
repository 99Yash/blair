import { openai } from '@ai-sdk/openai';
import { Experimental_Agent as Agent, Output, stepCountIs } from 'ai';
import { z } from 'zod';
import { linkTypeEnum, targetAudienceEnum, toneEnum } from '~/db/schemas';
import { scrapeWebsiteTool, searchVectorDatabaseTool } from './tools';

const analysisAgent = new Agent({
  model: openai('gpt-4o-mini'),
  experimental_output: Output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  }),
  stopWhen: stepCountIs(10),
});

const { experimental_output: output } = await analysisAgent.generate({
  prompt: 'Analyze customer feedback from the last quarter',
});

// Define the final output schema for what the agent should produce
const teaserAgentOutputSchema = z.object({
  generated_post_content: z
    .string()
    .describe('The full generated social media post content.'),
  content_summary_of_link: z
    .string()
    .describe("The summary of the user's linked content."),
  inferred_content_type: z
    .enum(linkTypeEnum.enumValues)
    .describe("The inferred type of the user's linked content."),
  inferred_target_audience: z
    .enum(targetAudienceEnum.enumValues)
    .describe("The inferred target audience of the user's linked content."),
  inferred_tone_profile: z
    .array(
      z.object({
        tone: z.enum(toneEnum.enumValues),
        weight: z.number().int().min(0).max(100),
      })
    )
    .describe("The inferred tone profile of the user's linked content."),
  inferred_call_to_action_type: z
    .enum(linkTypeEnum.enumValues) // This should be ctaTypeEnum, ensure consistent naming
    .describe("The inferred call to action type of the user's linked content."),
  inferred_sales_pitch_strength: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      "The inferred sales pitch strength of the user's linked content (1-10)."
    ),
});

export const teaserGenerationAgent = new Agent({
  model: openai('gpt-4o'), // Using gpt-4o for better reasoning with agents
  tools: {
    scrape_website: scrapeWebsiteTool,
    search_vector_database: searchVectorDatabaseTool,
  },
  // Define the final structure the agent should return
  experimental_output: Output.object({
    schema: teaserAgentOutputSchema,
  }),
  // Optional: Set a limit on the number of steps the agent can take
  // stopWhen: stepCountIs(10), // You might adjust this based on complexity
});
