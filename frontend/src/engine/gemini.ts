// ABOUTME: Gemini streaming client with rate-limit retry for browser-side redaction.
// ABOUTME: Ports the backend's identify_redactions + retry logic to @google/genai SDK.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { type GeminiRedactionResult, RedactionEngineError, type TokenUsage } from "./types";

const MAX_RETRY_ATTEMPTS = 4;
const INITIAL_WAIT_MS = 30_000;
const MAX_WAIT_MS = 120_000;

const SYSTEM_INSTRUCTION = `\
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

function buildUserMessage(pdfText: Map<number, string>, redactionPrompt: string): string {
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

/** Map our lowercase thinking levels to the SDK's enum values */
function toThinkingLevel(level: string): ThinkingLevel {
  const map: Record<string, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };
  return map[level] ?? ThinkingLevel.LOW;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract a human-readable message from a Gemini API error (which may contain nested JSON). */
function extractGeminiErrorMessage(raw: string): string {
  try {
    // The SDK wraps errors as JSON with a nested "message" field that is itself JSON
    const outer = JSON.parse(raw) as { error?: { message?: string } };
    const innerStr = outer.error?.message;
    if (innerStr) {
      try {
        const inner = JSON.parse(innerStr) as { error?: { message?: string } };
        if (inner.error?.message) return inner.error.message;
      } catch {
        return innerStr;
      }
    }
  } catch {
    // Not JSON — try to find a readable substring
    const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  }
  return raw;
}

/**
 * Call Gemini to identify redaction targets, with exponential backoff on 429s.
 */
export async function identifyRedactions(
  apiKey: string,
  model: string,
  pdfText: Map<number, string>,
  redactionPrompt: string,
  thinkingLevel: string,
): Promise<{ result: GeminiRedactionResult; usage: TokenUsage }> {
  const ai = new GoogleGenAI({ apiKey });
  const userMessage = buildUserMessage(pdfText, redactionPrompt);

  // Gemini 3+ models support thinking levels; 2.x models do not
  const thinkingConfig = model.startsWith("gemini-2")
    ? undefined
    : { thinkingLevel: toThinkingLevel(thinkingLevel) };

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const startTime = performance.now();
      let fullResponse = "";
      let promptTokenCount = 0;
      let candidatesTokenCount = 0;
      let thoughtsTokenCount = 0;
      let totalTokenCount = 0;

      const stream = await ai.models.generateContentStream({
        model,
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          thinkingConfig,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
        if (chunk.usageMetadata) {
          promptTokenCount = chunk.usageMetadata.promptTokenCount ?? 0;
          candidatesTokenCount = chunk.usageMetadata.candidatesTokenCount ?? 0;
          thoughtsTokenCount = chunk.usageMetadata.thoughtsTokenCount ?? 0;
          totalTokenCount = chunk.usageMetadata.totalTokenCount ?? 0;
        }
      }

      const durationMs = Math.round(performance.now() - startTime);

      const usage: TokenUsage = {
        inputTokens: promptTokenCount,
        outputTokens: candidatesTokenCount,
        thinkingTokens: thoughtsTokenCount,
        totalTokens: totalTokenCount,
        model,
        durationMs,
      };

      let parsed: GeminiRedactionResult;
      try {
        parsed = JSON.parse(fullResponse) as GeminiRedactionResult;
      } catch {
        throw new RedactionEngineError("PARSE", "Failed to parse AI response.");
      }

      // Ensure targets array exists
      if (!Array.isArray(parsed.targets)) {
        parsed = { targets: [], reasoning: parsed.reasoning ?? null };
      }

      return { result: parsed, usage };
    } catch (error) {
      lastError = error;

      // Re-throw our own engine errors (non-retryable)
      if (error instanceof RedactionEngineError) throw error;

      // Only retry on 429 rate limit errors
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") || error.message.toLowerCase().includes("rate limit"));

      if (!isRateLimit || attempt === MAX_RETRY_ATTEMPTS) break;

      const waitMs = Math.min(INITIAL_WAIT_MS * 2 ** (attempt - 1), MAX_WAIT_MS);
      await sleep(waitMs);
    }
  }

  // Classify the final error
  if (lastError instanceof RedactionEngineError) throw lastError;

  const rawMessage = lastError instanceof Error ? lastError.message : String(lastError);
  const friendlyMessage = extractGeminiErrorMessage(rawMessage);

  if (rawMessage.includes("429") || rawMessage.toLowerCase().includes("rate limit")) {
    throw new RedactionEngineError(
      "RATE_LIMIT",
      "The AI service is temporarily under high demand. Please try again in a few moments.",
    );
  }

  if (rawMessage.includes("API key") || rawMessage.includes("401") || rawMessage.includes("403")) {
    throw new RedactionEngineError("API_KEY_INVALID", "API key is invalid or expired.");
  }

  if (rawMessage.includes("400")) {
    throw new RedactionEngineError("PARSE", friendlyMessage);
  }

  throw new RedactionEngineError("NETWORK", friendlyMessage);
}

/** Lightweight call to validate an API key. */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say OK",
      config: { maxOutputTokens: 5 },
    });
    return true;
  } catch {
    return false;
  }
}
