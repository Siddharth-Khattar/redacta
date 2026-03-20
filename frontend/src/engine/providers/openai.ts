// ABOUTME: OpenAI provider using raw fetch to the chat completions API.
// ABOUTME: Supports GPT-5.4 family with reasoning.effort for thinking levels.

import { RedactionEngineError, type RedactionResult, type TokenUsage } from "../types";
import { buildUserMessage, DEFAULT_RETRY_CONFIG, SYSTEM_INSTRUCTION, withRetry } from "./shared";
import type { RedactionProvider } from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** Map our thinking levels to OpenAI's reasoning effort values */
const REASONING_EFFORT_MAP: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

interface OpenAIChatResponse {
  choices: Array<{
    message: { content: string | null };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

interface OpenAIErrorResponse {
  error?: { message?: string; type?: string };
}

function isRateLimitError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("429") || error.message.toLowerCase().includes("rate limit"))
  );
}

function classifyError(error: unknown): never {
  if (error instanceof RedactionEngineError) throw error;

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
    throw new RedactionEngineError(
      "RATE_LIMIT",
      "OpenAI is temporarily under high demand. Please try again in a few moments.",
    );
  }
  if (
    message.includes("401") ||
    message.includes("invalid_api_key") ||
    message.includes("Incorrect API key")
  ) {
    throw new RedactionEngineError("API_KEY_INVALID", "OpenAI API key is invalid or expired.");
  }
  if (message.includes("400")) {
    throw new RedactionEngineError("PARSE", message);
  }
  throw new RedactionEngineError("NETWORK", message);
}

export class OpenAIProvider implements RedactionProvider {
  async identifyRedactions(
    apiKey: string,
    model: string,
    pdfText: Map<number, string>,
    redactionPrompt: string,
    thinkingLevel: string,
  ): Promise<{ result: RedactionResult; usage: TokenUsage }> {
    const userMessage = buildUserMessage(pdfText, redactionPrompt);
    const effort = REASONING_EFFORT_MAP[thinkingLevel] ?? "low";

    try {
      return await withRetry(
        async () => {
          const startTime = performance.now();

          const body: Record<string, unknown> = {
            model,
            messages: [
              { role: "system", content: SYSTEM_INSTRUCTION },
              { role: "user", content: userMessage },
            ],
            response_format: { type: "json_object" },
            reasoning_effort: effort,
          };

          const resp = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!resp.ok) {
            const errorText = await resp.text();
            let errorMessage = `OpenAI API error ${resp.status}: ${errorText}`;
            try {
              const errorData = JSON.parse(errorText) as OpenAIErrorResponse;
              if (errorData.error?.message) {
                errorMessage = `OpenAI API error ${resp.status}: ${errorData.error.message}`;
              }
            } catch {
              /* use raw text */
            }
            throw new Error(errorMessage);
          }

          const data = (await resp.json()) as OpenAIChatResponse;
          const durationMs = Math.round(performance.now() - startTime);

          const content = data.choices[0]?.message.content ?? "";
          const usageData = data.usage;
          const reasoningTokens = usageData?.completion_tokens_details?.reasoning_tokens ?? 0;

          const usage: TokenUsage = {
            inputTokens: usageData?.prompt_tokens ?? 0,
            outputTokens: (usageData?.completion_tokens ?? 0) - reasoningTokens,
            thinkingTokens: reasoningTokens,
            totalTokens: usageData?.total_tokens ?? 0,
            model,
            durationMs,
          };

          let parsed: RedactionResult;
          try {
            parsed = JSON.parse(content) as RedactionResult;
          } catch {
            throw new RedactionEngineError("PARSE", "Failed to parse OpenAI response as JSON.");
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
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return resp.ok;
    } catch {
      return false;
    }
  }
}
