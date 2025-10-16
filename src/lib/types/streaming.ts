import { UIMessage } from 'ai';

// Define mapped types for full type safety
export type StreamingDataMap = {
  progress: {
    stage: ProgressStage;
    message: string;
    status: 'loading' | 'success' | 'error';
    details?: string;
  };
  notification: {
    message: string;
    level: 'info' | 'warning' | 'error' | 'success';
  };
  content_analysis: {
    content_summary: string;
    content_type: string;
    target_audience: string;
    tone_profile?: Array<{ tone: string; weight: number }>;
    call_to_action_type?: string;
    sales_pitch_strength?: number;
  };
  training_posts: {
    count: number;
    examples?: Array<{
      content: string;
      platform: string;
      content_type: string;
    }>;
  };
  generated_post: {
    content: string;
    platform: string;
    estimated_engagement?: number;
  };
};

// Type for the actual chunk format expected by AI SDK
export type StreamingChunk<T extends keyof StreamingDataMap> = {
  type: `data-${T}`;
  id?: string;
  data: StreamingDataMap[T];
  transient?: boolean;
};

// Define custom data parts for streaming progress updates
export type StreamingDataParts = StreamingDataMap;

// Custom UIMessage type for our streaming post generation
export type StreamingPostMessage = UIMessage<
  never, // metadata type
  StreamingDataParts
>;

// Progress stage definitions
export const PROGRESS_STAGES = {
  SCRAPING: 'scraping',
  ANALYZING: 'analyzing',
  SEARCHING: 'searching',
  GENERATING: 'generating',
  SAVING: 'saving',
} as const;

export type ProgressStage =
  (typeof PROGRESS_STAGES)[keyof typeof PROGRESS_STAGES];

// Generic helper function for creating fully type-safe streaming data
export function createStreamingData<K extends keyof StreamingDataMap>(
  type: K,
  data: StreamingDataMap[K]
): StreamingChunk<K> {
  return {
    type: `data-${type}`,
    data,
  };
}

// Type-safe helper functions with proper type constraints

// Helper function to create progress data parts
export function createProgressData(
  stage: ProgressStage,
  message: string,
  status: 'loading' | 'success' | 'error' = 'loading',
  details?: string
): StreamingChunk<'progress'> {
  return createStreamingData('progress', {
    stage,
    message,
    status,
    details,
  });
}

// Helper function to create notification data parts
export function createNotificationData(
  message: string,
  level: 'info' | 'warning' | 'error' | 'success' = 'info'
): StreamingChunk<'notification'> {
  return {
    ...createStreamingData('notification', { message, level }),
    transient: true, // Notifications are transient
  };
}

// Helper function to create content analysis data parts
export function createContentAnalysisData(
  analysis: StreamingDataMap['content_analysis']
): StreamingChunk<'content_analysis'> {
  return createStreamingData('content_analysis', analysis);
}

// Helper function to create training posts data parts
export function createTrainingPostsData(
  count: number,
  examples?: StreamingDataMap['training_posts']['examples']
): StreamingChunk<'training_posts'> {
  return createStreamingData('training_posts', { count, examples });
}

// Helper function to create generated post data parts
export function createGeneratedPostData(
  content: string,
  platform: string,
  estimated_engagement?: number
): StreamingChunk<'generated_post'> {
  return createStreamingData('generated_post', {
    content,
    platform,
    estimated_engagement,
  });
}

// Utility type for extracting data types
export type StreamingDataType<K extends keyof StreamingDataMap> = {
  type: K;
  data: StreamingDataMap[K];
};
