import {
  APICallError,
  DownloadError,
  EmptyResponseBodyError,
  InvalidArgumentError,
  InvalidDataContentError,
  InvalidMessageRoleError,
  InvalidPromptError,
  InvalidResponseDataError,
  InvalidToolInputError,
  JSONParseError,
  LoadAPIKeyError,
  MessageConversionError,
  NoContentGeneratedError,
  NoImageGeneratedError,
  NoObjectGeneratedError,
  NoOutputSpecifiedError,
  NoSpeechGeneratedError,
  NoSuchModelError,
  NoSuchProviderError,
  NoSuchToolError,
  RetryError,
  ToolCallRepairError,
  TooManyEmbeddingValuesForCallError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from 'ai';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as z from 'zod/v4';
import {
  LOCAL_STORAGE_SCHEMAS,
  LocalStorageKey,
  LocalStorageValue,
} from './constants';
import { AppError } from './errors';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const unknownError = 'Something went wrong. Please try again.';

/**
 * Enhanced error message extraction that handles AppError instances
 */
export function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  } else if (err instanceof AppError) {
    return err.message;
  } else if (err instanceof z.ZodError) {
    return err.issues.map((e) => e.message).join(', ') ?? unknownError;
  } else if (err instanceof Error) {
    return err.message;
  } else {
    return unknownError;
  }
}

/**
 * Converts technical AI SDK errors into user-friendly messages
 * Uses AI SDK's .isInstance() methods for type-safe error checking
 */
export function getAIErrorMessage(err: unknown): string {
  // API Call Errors - Check specific HTTP status codes
  if (APICallError.isInstance(err)) {
    const message = err.message.toLowerCase();

    if (message.includes('quota') || message.includes('insufficient_quota')) {
      return 'AI service quota exceeded. Please try again later.';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'AI service authentication failed. Please contact support.';
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'Access denied to AI service. Please contact support.';
    }
    if (message.includes('404')) {
      return 'AI service endpoint not found. Please contact support.';
    }
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    ) {
      return 'AI service is temporarily unavailable. Please try again in a moment.';
    }
    return 'AI service error occurred. Please try again.';
  }

  // Content Generation Errors
  if (NoContentGeneratedError.isInstance(err)) {
    return 'AI did not generate any content. Please try again with different input.';
  }

  if (NoObjectGeneratedError.isInstance(err)) {
    return 'AI failed to generate the required data structure. Please try again.';
  }

  if (NoImageGeneratedError.isInstance(err)) {
    return 'AI failed to generate an image. Please try again.';
  }

  if (NoSpeechGeneratedError.isInstance(err)) {
    return 'AI failed to generate speech. Please try again.';
  }

  // Model/Provider Errors
  if (NoSuchModelError.isInstance(err)) {
    return 'The requested AI model is not available. Please contact support.';
  }

  if (NoSuchProviderError.isInstance(err)) {
    return 'AI provider configuration error. Please contact support.';
  }

  if (UnsupportedFunctionalityError.isInstance(err)) {
    return 'This feature is not supported by the current AI model. Please contact support.';
  }

  // Input/Validation Errors
  if (InvalidArgumentError.isInstance(err)) {
    return 'Invalid input provided. Please check your data and try again.';
  }

  if (InvalidPromptError.isInstance(err)) {
    return 'Invalid prompt format. Please try again with different content.';
  }

  if (InvalidMessageRoleError.isInstance(err)) {
    return 'Invalid message format. Please refresh and try again.';
  }

  if (InvalidToolInputError.isInstance(err)) {
    return 'Invalid tool configuration. Please contact support.';
  }

  if (TypeValidationError.isInstance(err)) {
    return 'Data validation failed. Please check your input and try again.';
  }

  // Data/Response Errors
  if (JSONParseError.isInstance(err)) {
    return 'Failed to parse AI response. Please try again.';
  }

  if (InvalidResponseDataError.isInstance(err)) {
    return 'Received invalid data from AI service. Please try again.';
  }

  if (InvalidDataContentError.isInstance(err)) {
    return 'Invalid data format received. Please try again.';
  }

  if (EmptyResponseBodyError.isInstance(err)) {
    return 'AI service returned an empty response. Please try again.';
  }

  // Network/Connection Errors
  if (DownloadError.isInstance(err)) {
    return 'Failed to download from AI service. Please check your connection and try again.';
  }

  if (RetryError.isInstance(err)) {
    return 'AI service request failed after multiple retries. Please try again later.';
  }

  // Configuration Errors
  if (LoadAPIKeyError.isInstance(err)) {
    return 'AI service configuration error. Please contact support.';
  }

  // Other Specific Errors
  if (NoSuchToolError.isInstance(err)) {
    return 'Required AI tool not found. Please contact support.';
  }

  if (ToolCallRepairError.isInstance(err)) {
    return 'AI tool execution failed. Please try again.';
  }

  if (MessageConversionError.isInstance(err)) {
    return 'Failed to process message format. Please refresh and try again.';
  }

  if (NoOutputSpecifiedError.isInstance(err)) {
    return 'AI configuration error. Please contact support.';
  }

  if (TooManyEmbeddingValuesForCallError.isInstance(err)) {
    return 'Too much data to process. Please try with a shorter input.';
  }

  // Fallback for generic errors (non-AI SDK errors)
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    const name = err.name?.toLowerCase() ?? '';

    if (
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('timed out')
    ) {
      return 'Request timed out. Please try again.';
    }

    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('connection')
    ) {
      return 'Network error. Please check your connection and try again.';
    }

    if (
      name.includes('abort') ||
      message.includes('abort') ||
      message.includes('cancelled')
    ) {
      return 'Request was cancelled. Please try again.';
    }

    // Log unhandled errors for debugging
    console.error('Unhandled AI error type:', err.name, err.message);
  }

  // Generic fallback
  return 'AI service encountered an error. Please try again.';
}

/**
 * Creates a standardized validation error from Zod issues
 */
export function createValidationError(issues: z.ZodIssue[]): AppError {
  const message = issues.map((issue) => issue.message).join(', ');
  return new AppError({
    code: 'UNPROCESSABLE_CONTENT',
    message: `Validation error: ${message}`,
  });
}

/**
 * Creates a standardized database error
 */
export function createDatabaseError(
  message?: string,
  cause?: unknown
): AppError {
  return new AppError({
    code: 'INTERNAL_SERVER_ERROR',
    message: message ?? 'Database operation failed',
    cause,
  });
}

/**
 * Creates a standardized authentication error
 */
export function createAuthError(message?: string): AppError {
  return new AppError({
    code: 'UNAUTHORIZED',
    message: message ?? 'Authentication required',
  });
}

/**
 * Creates a standardized conflict error (e.g., duplicate data)
 */
export function createConflictError(
  message?: string,
  cause?: unknown
): AppError {
  return new AppError({
    code: 'CONFLICT',
    message: message ?? 'Resource already exists',
    cause,
  });
}

/**
 * Creates a standardized external service error (e.g., scraping, AI service)
 */
export function createExternalServiceError(
  service: string,
  message?: string,
  cause?: unknown
): AppError {
  return new AppError({
    code: 'INTERNAL_SERVER_ERROR',
    message: message ?? `${service} service unavailable`,
    cause,
  });
}

export function setLocalStorageItem<K extends LocalStorageKey>(
  key: K,
  value: LocalStorageValue<K>
): void {
  try {
    const schema = LOCAL_STORAGE_SCHEMAS[key];
    const validationResult = schema.safeParse(value);

    if (!validationResult.success) {
      console.error(
        `[LocalStorageError] Invalid value for key "${key}":`,
        validationResult.error.issues
      );
      return;
    }

    localStorage.setItem(key, JSON.stringify(validationResult.data));
  } catch (error) {
    console.error(
      `[LocalStorageError] Failed to set item for key "${key}":`,
      error
    );
  }
}

export function getLocalStorageItem<K extends LocalStorageKey>(
  key: K,
  defaultValue?: LocalStorageValue<K>
): LocalStorageValue<K> | undefined {
  const schema = LOCAL_STORAGE_SCHEMAS[key];
  const serializedValue = localStorage.getItem(key);

  if (serializedValue === null) {
    if (defaultValue !== undefined) {
      const defaultResult = schema.safeParse(defaultValue);
      return defaultResult.success ? defaultResult.data : undefined;
    }
    const schemaDefaultResult = schema.safeParse(undefined);
    return schemaDefaultResult.success ? schemaDefaultResult.data : undefined;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(serializedValue);
  } catch {
    console.warn(`[LocalStorageError] Failed to parse value for key "${key}"`);
    return defaultValue !== undefined ? defaultValue : undefined;
  }

  const validationResult = schema.safeParse(parsedValue);
  if (validationResult.success) {
    return validationResult.data;
  }

  console.warn(
    `[LocalStorageValidation] Invalid data for key "${key}":`,
    validationResult.error.issues
  );

  if (defaultValue !== undefined) {
    const defaultResult = schema.safeParse(defaultValue);
    return defaultResult.success ? defaultResult.data : undefined;
  }

  const schemaDefaultResult = schema.safeParse(undefined);
  return schemaDefaultResult.success ? schemaDefaultResult.data : undefined;
}

export function removeLocalStorageItem(key: LocalStorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(
      `[LocalStorageError] Failed to remove item for key "${key}":`,
      error
    );
  }
}
