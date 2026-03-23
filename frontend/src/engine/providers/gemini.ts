// ABOUTME: Google Gemini provider implementation using @google/genai SDK.
// ABOUTME: Handles both thinkingBudget (2.5) and thinkingLevel (3.x) configurations.

import { buildUserMessage, getSystemInstruction } from "../prompts";
import {
  type ProcessingMode,
  RedactionEngineError,
  type RedactionResult,
  type TokenUsage,
} from "../types";
import { DEFAULT_RETRY_CONFIG, withRetry } from "./shared";
import type { RedactionProvider } from "./types";

type GenAIModule = typeof import("@google/genai");

let cachedGenAI: GenAIModule | null = null;

/** Lazily load the @google/genai SDK (only pulled in when a Gemini call is made). */
async function loadGenAI(): Promise<GenAIModule> {
  if (cachedGenAI) return cachedGenAI;
  cachedGenAI = await import("@google/genai");
  return cachedGenAI;
}

/** Token budget mapping for Gemini 2.5 models (thinkingBudget param) */
const THINKING_BUDGET_MAP: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

/** Map UI thinking levels to SDK ThinkingLevel enum for Gemini 3.x models */
function toGeminiThinkingLevel(
  level: string,
  genai: GenAIModule,
): import("@google/genai").ThinkingLevel {
  const { ThinkingLevel } = genai;
  const map: Record<string, import("@google/genai").ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };
  return map[level] ?? ThinkingLevel.LOW;
}

/** Extract a human-readable message from Gemini's nested JSON error structure. */
function extractErrorMessage(raw: string): string {
  try {
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
    const match = raw.match(/"message"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return match[1];
  }
  return raw;
}

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("429") || error.message.toLowerCase().includes("rate limit"))
  );
}

function classifyError(error: unknown): never {
  if (error instanceof RedactionEngineError) throw error;

  const rawMessage = error instanceof Error ? error.message : String(error);
  const friendlyMessage = extractErrorMessage(rawMessage);

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

export class GeminiProvider implements RedactionProvider {
  async identifyTargets(
    apiKey: string,
    model: string,
    pdfText: Map<number, string>,
    redactionPrompt: string,
    thinkingLevel: string,
    mode: ProcessingMode,
    thorough = false,
  ): Promise<{ result: RedactionResult; usage: TokenUsage }> {
    const genai = await loadGenAI();
    const ai = new genai.GoogleGenAI({ apiKey });
    const userMessage = buildUserMessage(mode, pdfText, redactionPrompt);

    // Gemini 2.5 uses thinkingBudget (integer); 3.x uses thinkingLevel (enum)
    const is25 = model.startsWith("gemini-2");
    const thinkingConfig = is25
      ? { thinkingBudget: THINKING_BUDGET_MAP[thinkingLevel] ?? 1024 }
      : { thinkingLevel: toGeminiThinkingLevel(thinkingLevel, genai) };

    try {
      return await withRetry(
        async () => {
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
              systemInstruction: getSystemInstruction(mode, thorough),
              responseMimeType: "application/json",
              thinkingConfig,
            },
          });

          for await (const chunk of stream) {
            if (chunk.text) fullResponse += chunk.text;
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

          let parsed: RedactionResult;
          try {
            parsed = JSON.parse(fullResponse) as RedactionResult;
          } catch {
            throw new RedactionEngineError("PARSE", "Failed to parse AI response.");
          }

          if (!Array.isArray(parsed.targets)) {
            parsed = { targets: [], reasoning: parsed.reasoning ?? null };
          }

          return { result: parsed, usage };
        },
        isRateLimitError,
        DEFAULT_RETRY_CONFIG,
      );
    } catch (error) {
      classifyError(error);
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const genai = await loadGenAI();
      const ai = new genai.GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Say OK",
        config: { maxOutputTokens: 5 },
      });
      return true;
    } catch {
      return false;
    }
  }
}
