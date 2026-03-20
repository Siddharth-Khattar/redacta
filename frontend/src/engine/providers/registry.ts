// ABOUTME: Central registry of all supported LLM models and providers.
// ABOUTME: Provides model catalog, provider factory, and query helpers.

import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";
import type {
  ModelDefinition,
  ProviderConfig,
  ProviderId,
  RedactionProvider,
  ThinkingLevel,
} from "./types";

export const ALL_MODELS: ModelDefinition[] = [
  // Google Gemini
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    thinkingLevels: ["low", "medium", "high"],
    contextWindow: 1_000_000,
    pricing: { input: 0.15, output: 0.6, thinking: 0.6 },
  },
  {
    id: "gemini-3-flash-preview",
    provider: "gemini",
    label: "Gemini 3.0 Flash",
    thinkingLevels: ["minimal", "low", "medium", "high"],
    contextWindow: 1_000_000,
    pricing: { input: 0.5, output: 3.0, thinking: 3.0 },
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "gemini",
    label: "Gemini 3.1 Pro",
    thinkingLevels: ["low", "medium", "high"],
    contextWindow: 1_000_000,
    pricing: { input: 2.0, output: 12.0, thinking: 12.0 },
  },
  // OpenAI
  {
    id: "gpt-5.4",
    provider: "openai",
    label: "GPT-5.4",
    thinkingLevels: ["low", "medium", "high"],
    contextWindow: 1_050_000,
    pricing: { input: 2.5, output: 15.0, thinking: 15.0 },
  },
  {
    id: "gpt-5.4-mini",
    provider: "openai",
    label: "GPT-5.4 Mini",
    thinkingLevels: ["low", "medium", "high"],
    contextWindow: 400_000,
    pricing: { input: 0.75, output: 4.5, thinking: 4.5 },
  },
];

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    keyPlaceholder: "AIza...",
    keyUrl: "https://aistudio.google.com/apikey",
    keyUrlLabel: "Google AI Studio",
  },
  {
    id: "openai",
    name: "OpenAI",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "OpenAI Platform",
  },
];

const providerInstances: Partial<Record<ProviderId, RedactionProvider>> = {};

/** Get or lazily create a provider instance. */
export function getProvider(id: ProviderId): RedactionProvider {
  if (!providerInstances[id]) {
    switch (id) {
      case "gemini":
        providerInstances[id] = new GeminiProvider();
        break;
      case "openai":
        providerInstances[id] = new OpenAIProvider();
        break;
    }
  }
  return providerInstances[id]!;
}

export function getModelDefinition(modelId: string): ModelDefinition | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

export function getModelsForProvider(providerId: ProviderId): ModelDefinition[] {
  return ALL_MODELS.filter((m) => m.provider === providerId);
}

export function getProviderConfig(providerId: ProviderId): ProviderConfig {
  return PROVIDERS.find((p) => p.id === providerId)!;
}

export function getProviderForModel(modelId: string): ProviderId | undefined {
  return ALL_MODELS.find((m) => m.id === modelId)?.provider;
}

export function getDefaultThinkingLevel(modelId: string): ThinkingLevel {
  const model = getModelDefinition(modelId);
  if (!model || model.thinkingLevels.length === 0) return "low";
  return model.thinkingLevels[0]!;
}
