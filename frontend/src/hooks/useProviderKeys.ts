// ABOUTME: React hook for managing per-provider API keys in localStorage.
// ABOUTME: Handles migration from legacy single-key storage and provides reactive state updates.

import { useCallback, useState } from "react";
import type { ProviderId } from "../engine/providers/types";

const STORAGE_KEYS: Record<ProviderId, string> = {
  gemini: "redacta-key-gemini",
  openai: "redacta-key-openai",
};

const LEGACY_KEY = "redacta-api-key";
const ALL_PROVIDERS: ProviderId[] = ["gemini", "openai"];

// One-time migration: legacy single key → per-provider Gemini key
(function migrateLegacyKey() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && !localStorage.getItem(STORAGE_KEYS.gemini)) {
      localStorage.setItem(STORAGE_KEYS.gemini, legacy);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore in environments without localStorage */
  }
})();

export type ProviderKeys = Record<ProviderId, string | null>;

function readAllKeys(): ProviderKeys {
  const keys: ProviderKeys = { gemini: null, openai: null };
  try {
    for (const id of ALL_PROVIDERS) {
      keys[id] = localStorage.getItem(STORAGE_KEYS[id]);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

export interface UseProviderKeysReturn {
  keys: ProviderKeys;
  hasAnyKey: boolean;
  configuredProviders: ProviderId[];
  getKey: (provider: ProviderId) => string | null;
  setKey: (provider: ProviderId, key: string) => void;
  clearKey: (provider: ProviderId) => void;
  clearAllKeys: () => void;
}

export function useProviderKeys(): UseProviderKeysReturn {
  const [keys, setKeysState] = useState<ProviderKeys>(readAllKeys);

  const setKey = useCallback((provider: ProviderId, key: string) => {
    localStorage.setItem(STORAGE_KEYS[provider], key);
    setKeysState((prev) => ({ ...prev, [provider]: key }));
  }, []);

  const clearKey = useCallback((provider: ProviderId) => {
    localStorage.removeItem(STORAGE_KEYS[provider]);
    setKeysState((prev) => ({ ...prev, [provider]: null }));
  }, []);

  const clearAllKeys = useCallback(() => {
    for (const id of ALL_PROVIDERS) {
      localStorage.removeItem(STORAGE_KEYS[id]);
    }
    setKeysState({ gemini: null, openai: null });
  }, []);

  const getKey = useCallback((provider: ProviderId) => keys[provider], [keys]);

  const configuredProviders = ALL_PROVIDERS.filter((id) => keys[id] !== null && keys[id] !== "");
  const hasAnyKey = configuredProviders.length > 0;

  return { keys, hasAnyKey, configuredProviders, getKey, setKey, clearKey, clearAllKeys };
}
