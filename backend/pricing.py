# ABOUTME: Gemini model pricing fetcher with OpenRouter as live source.
# ABOUTME: Caches pricing in memory with TTL, falls back to hardcoded defaults.

import logging
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours
FETCH_TIMEOUT_SECONDS = 10

# Mapping from our model IDs to OpenRouter model IDs
_MODEL_ID_MAP: dict[str, str] = {
    "gemini-2.0-flash": "google/gemini-2.0-flash-001",
    "gemini-3-flash-preview": "google/gemini-3-flash-preview",
    "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
}


@dataclass
class ModelPricing:
    """Per-million-token pricing for a single model (USD)."""

    input: float
    output: float
    thinking: float


# Accurate defaults as of March 2026 (source: ai.google.dev/gemini-api/docs/pricing)
DEFAULT_PRICING: dict[str, ModelPricing] = {
    "gemini-2.0-flash": ModelPricing(input=0.10, output=0.40, thinking=0.0),
    "gemini-3-flash-preview": ModelPricing(input=0.50, output=3.00, thinking=3.00),
    "gemini-3.1-pro-preview": ModelPricing(input=2.00, output=12.00, thinking=12.00),
}


@dataclass
class _PricingCache:
    """Module-level pricing cache with TTL."""

    pricing: dict[str, ModelPricing] = field(default_factory=dict)
    fetched_at: float = 0.0
    source: str = "default"

    @property
    def is_stale(self) -> bool:
        return time.monotonic() - self.fetched_at > CACHE_TTL_SECONDS


_cache = _PricingCache()


def _parse_openrouter_response(data: dict[str, Any]) -> dict[str, ModelPricing]:
    """Extract per-million-token pricing from OpenRouter response."""
    models: list[dict[str, Any]] = data.get("data", [])
    openrouter_to_local = {v: k for k, v in _MODEL_ID_MAP.items()}
    result: dict[str, ModelPricing] = {}

    for model in models:
        model_id: str = model.get("id", "")
        local_id = openrouter_to_local.get(model_id)
        if not local_id:
            continue

        pricing = model.get("pricing", {})
        # OpenRouter prices are per-token; convert to per-million
        per_m = 1_000_000
        input_price = float(pricing.get("prompt", 0)) * per_m
        output_price = float(pricing.get("completion", 0)) * per_m
        thinking_price = float(pricing.get("internal_reasoning", 0)) * per_m

        result[local_id] = ModelPricing(
            input=input_price,
            output=output_price,
            thinking=thinking_price,
        )

    return result


def _fetch_from_openrouter() -> dict[str, ModelPricing] | None:
    """Fetch pricing from OpenRouter. Returns None on failure."""
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT_SECONDS) as client:
            resp = client.get(OPENROUTER_MODELS_URL)
            resp.raise_for_status()
            parsed = _parse_openrouter_response(resp.json())
            if parsed:
                logger.info(f"Fetched pricing for {len(parsed)} models from OpenRouter")
                return parsed
            logger.warning("OpenRouter response contained no matching Gemini models")
            return None
    except Exception as e:
        logger.warning(f"Failed to fetch pricing from OpenRouter: {e}")
        return None


def get_pricing() -> tuple[dict[str, ModelPricing], str]:
    """Return current pricing and its source ("openrouter" or "default").

    Uses a cached OpenRouter response if fresh, otherwise refetches.
    Falls back to hardcoded defaults on fetch failure.
    """
    global _cache  # noqa: PLW0603

    if _cache.pricing and not _cache.is_stale:
        return _cache.pricing, _cache.source

    live = _fetch_from_openrouter()
    if live:
        _cache = _PricingCache(
            pricing=live,
            fetched_at=time.monotonic(),
            source="openrouter",
        )
        return _cache.pricing, _cache.source

    # Fall back to defaults (always available)
    logger.info("Using default hardcoded pricing")
    return DEFAULT_PRICING, "default"


def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    thinking_tokens: int,
) -> tuple[float, str]:
    """Estimate cost in USD for a Gemini call. Returns (cost, pricing_source)."""
    pricing_map, source = get_pricing()
    model_pricing = pricing_map.get(model)
    if not model_pricing:
        return 0.0, source

    scale = 1 / 1_000_000
    cost = (
        input_tokens * model_pricing.input * scale
        + output_tokens * model_pricing.output * scale
        + thinking_tokens * model_pricing.thinking * scale
    )
    return cost, source
