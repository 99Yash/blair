import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as z from 'zod/v4';
import {
  LOCAL_STORAGE_SCHEMAS,
  LocalStorageKey,
  LocalStorageValue,
  SESSION_STORAGE_SCHEMAS,
  SessionStorageKey,
  SessionStorageValue,
} from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const unknownError = 'Something went wrong. Please try again.';

export function getErrorMessage(err: unknown) {
  if (typeof err === 'string') {
    return err;
  } else if (err instanceof z.ZodError) {
    return err.issues.map((e) => e.message).join(', ') ?? unknownError;
  } else if (err instanceof Error) {
    return err.message;
  } else {
    return unknownError;
  }
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

export function setSessionStorageItem<K extends SessionStorageKey>(
  key: K,
  value: SessionStorageValue<K>
): void {
  try {
    if (typeof window === 'undefined' || !('sessionStorage' in window)) {
      return;
    }

    const schema = SESSION_STORAGE_SCHEMAS[key];
    const validationResult = schema.safeParse(value);

    if (!validationResult.success) {
      console.error(
        `[SessionStorageError] Invalid value for key "${key}":`,
        validationResult.error.issues
      );
      return;
    }

    sessionStorage.setItem(key, JSON.stringify(validationResult.data));
  } catch (error) {
    console.debug(
      `[SessionStorageError] Failed to set item for key "${key}":`,
      error
    );
  }
}

export function getSessionStorageItem<K extends SessionStorageKey>(
  key: K,
  defaultValue?: SessionStorageValue<K>
): SessionStorageValue<K> | undefined {
  if (typeof window === 'undefined' || !('sessionStorage' in window)) {
    const schema = SESSION_STORAGE_SCHEMAS[key];
    const schemaDefaultResult = schema.safeParse(defaultValue);
    return schemaDefaultResult.success ? schemaDefaultResult.data : undefined;
  }

  const schema = SESSION_STORAGE_SCHEMAS[key];
  const serializedValue = sessionStorage.getItem(key);

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
    console.warn(
      `[SessionStorageError] Failed to parse value for key "${key}"`
    );
    return defaultValue !== undefined ? defaultValue : undefined;
  }

  const validationResult = schema.safeParse(parsedValue);
  if (validationResult.success) {
    return validationResult.data;
  }

  console.warn(
    `[SessionStorageValidation] Invalid data for key "${key}":`,
    validationResult.error.issues
  );

  if (defaultValue !== undefined) {
    const defaultResult = schema.safeParse(defaultValue);
    return defaultResult.success ? defaultResult.data : undefined;
  }

  const schemaDefaultResult = schema.safeParse(undefined);
  return schemaDefaultResult.success ? schemaDefaultResult.data : undefined;
}

export function removeSessionStorageItem(key: SessionStorageKey): void {
  try {
    if (typeof window === 'undefined' || !('sessionStorage' in window)) {
      return;
    }
    sessionStorage.removeItem(key);
  } catch (error) {
    console.debug(
      `[SessionStorageError] Failed to remove item for key "${key}":`,
      error
    );
  }
}
