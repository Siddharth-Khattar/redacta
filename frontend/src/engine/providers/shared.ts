// ABOUTME: Shared retry utilities used across all LLM providers.
// ABOUTME: Contains generic exponential-backoff retry logic with configurable predicates.

import { RedactionEngineError } from "../types";

export interface RetryConfig {
  maxAttempts: number;
  initialWaitMs: number;
  maxWaitMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 4,
  initialWaitMs: 30_000,
  maxWaitMs: 120_000,
};

/**
 * Generic retry wrapper with exponential backoff.
 * Each provider supplies its own `isRetryable` predicate to decide which errors warrant a retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Never retry our own classified errors
      if (error instanceof RedactionEngineError) throw error;

      if (!isRetryable(error) || attempt === config.maxAttempts) break;

      const waitMs = Math.min(config.initialWaitMs * 2 ** (attempt - 1), config.maxWaitMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}
