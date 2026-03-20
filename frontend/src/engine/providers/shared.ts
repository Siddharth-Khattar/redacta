// ABOUTME: Shared utilities used across all LLM providers.
// ABOUTME: Contains system prompt, message builder, and generic retry logic.

import { RedactionEngineError } from "../types";

export const SYSTEM_INSTRUCTION = `\
You are a precise document redaction assistant. \
Your task is to identify EXACT text segments that should be \
redacted based on user instructions.

CRITICAL REQUIREMENTS:
1. Return EXACT text as it appears in the document (word-for-word)
2. Include the correct page number (1-indexed)
3. For ambiguous cases, include surrounding context
4. Be conservative - only redact what clearly matches the criteria
5. Return valid JSON matching the RedactionResponse schema

Example output format:
{
  "targets": [
    {
      "text": "John Smith",
      "page": 1,
      "context": "Plaintiff John Smith filed a complaint"
    },
    {
      "text": "555-1234",
      "page": 2,
      "context": "Contact at 555-1234 for further"
    }
  ],
  "reasoning": "Redacted personal names and phone numbers as requested"
}`;

export function buildUserMessage(pdfText: Map<number, string>, redactionPrompt: string): string {
  const pdfContent = Array.from(pdfText.entries())
    .map(([page, text]) => `=== PAGE ${page} ===\n${text}`)
    .join("\n\n");

  return `DOCUMENT CONTENT:
${pdfContent}

REDACTION INSTRUCTIONS:
${redactionPrompt}

Identify all text segments that match the redaction criteria. Return a JSON object with:
- targets: array of {text, page, context} objects
- reasoning: brief explanation of your decisions`;
}

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
