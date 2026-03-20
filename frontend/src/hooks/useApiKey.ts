// ABOUTME: React hook for managing the user's Gemini API key in localStorage.
// ABOUTME: Provides get/set/clear operations with reactive state updates.

import { useCallback, useState } from "react";

const STORAGE_KEY = "redacta-api-key";

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export interface UseApiKeyReturn {
  apiKey: string | null;
  hasApiKey: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

export function useApiKey(): UseApiKeyReturn {
  const [apiKey, setApiKeyState] = useState<string | null>(readStoredKey);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKeyState(key);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  }, []);

  return {
    apiKey,
    hasApiKey: apiKey !== null && apiKey.length > 0,
    setApiKey,
    clearApiKey,
  };
}
