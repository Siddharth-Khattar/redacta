// ABOUTME: Gemini model pricing fetcher with OpenRouter as live source.
// ABOUTME: Caches pricing in memory with 6h TTL, falls back to hardcoded defaults.

import type { CostEstimate, ModelPricing } from "./types";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 10_000;

/** Mapping from our model IDs to OpenRouter model IDs */
const MODEL_ID_MAP: Record<string, string> = {
  "gemini-2.0-flash": "google/gemini-2.0-flash-001",
  "gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
};

/** Accurate defaults as of March 2026 (source: ai.google.dev/gemini-api/docs/pricing) */
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": { input: 0.1, output: 0.4, thinking: 0 },
  "gemini-3-flash-preview": { input: 0.5, output: 3.0, thinking: 3.0 },
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0, thinking: 12.0 },
};

interface PricingCache {
  pricing: Record<string, ModelPricing>;
  fetchedAt: number;
  source: string;
}

let cache: PricingCache | null = null;

function isCacheStale(): boolean {
  if (!cache) return true;
  return Date.now() - cache.fetchedAt > CACHE_TTL_MS;
}

interface OpenRouterModel {
  id: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    internal_reasoning?: string;
  };
}

function parseOpenRouterResponse(data: { data?: OpenRouterModel[] }): Record<string, ModelPricing> {
  const models = data.data ?? [];
  const openrouterToLocal = Object.fromEntries(
    Object.entries(MODEL_ID_MAP).map(([local, or]) => [or, local]),
  );
  const result: Record<string, ModelPricing> = {};

  for (const model of models) {
    const localId = openrouterToLocal[model.id];
    if (!localId) continue;

    const pricing = model.pricing ?? {};
    const perM = 1_000_000;
    result[localId] = {
      input: Number.parseFloat(pricing.prompt ?? "0") * perM,
      output: Number.parseFloat(pricing.completion ?? "0") * perM,
      thinking: Number.parseFloat(pricing.internal_reasoning ?? "0") * perM,
    };
  }

  return result;
}

async function fetchFromOpenRouter(): Promise<Record<string, ModelPricing> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(OPENROUTER_MODELS_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) return null;

    const parsed = parseOpenRouterResponse(await resp.json());
    return Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Return current pricing and its source ("openrouter" or "default").
 * Uses a cached OpenRouter response if fresh, otherwise refetches.
 * Falls back to hardcoded defaults on fetch failure.
 */
export async function fetchPricing(): Promise<{
  pricing: Record<string, ModelPricing>;
  source: string;
}> {
  if (cache && !isCacheStale()) {
    return { pricing: cache.pricing, source: cache.source };
  }

  const live = await fetchFromOpenRouter();
  if (live) {
    cache = { pricing: live, fetchedAt: Date.now(), source: "openrouter" };
    return { pricing: cache.pricing, source: cache.source };
  }

  return { pricing: DEFAULT_PRICING, source: "default" };
}

/** Estimate cost in USD for a Gemini call. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number,
  pricingMap: Record<string, ModelPricing>,
  pricingSource: string,
): CostEstimate {
  const modelPricing = pricingMap[model];
  if (!modelPricing) return { costUsd: 0, pricingSource };

  const scale = 1 / 1_000_000;
  const costUsd =
    inputTokens * modelPricing.input * scale +
    outputTokens * modelPricing.output * scale +
    thinkingTokens * modelPricing.thinking * scale;

  return { costUsd, pricingSource };
}
