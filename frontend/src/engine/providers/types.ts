// ABOUTME: Provider abstraction types for multi-LLM support.
// ABOUTME: Defines ProviderId, ModelDefinition, ProviderConfig, and the RedactionProvider interface.

import type { ProcessingMode, RedactionResult, TokenUsage } from "../types";

export type ProviderId = "gemini" | "openai";

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface ModelDefinition {
  id: string;
  provider: ProviderId;
  label: string;
  thinkingLevels: ThinkingLevel[];
  contextWindow: number;
  /** Per-million-token pricing */
  pricing: { input: number; output: number; thinking: number };
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  keyPlaceholder: string;
  keyUrl: string;
  keyUrlLabel: string;
}

export interface RedactionProvider {
  identifyTargets(
    apiKey: string,
    model: string,
    pdfText: Map<number, string>,
    redactionPrompt: string,
    thinkingLevel: string,
    mode: ProcessingMode,
    existingMappings?: Record<string, string>,
  ): Promise<{ result: RedactionResult; usage: TokenUsage }>;

  validateApiKey(apiKey: string): Promise<boolean>;
}
