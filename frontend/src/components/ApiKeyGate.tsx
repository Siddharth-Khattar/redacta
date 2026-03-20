// ABOUTME: Full-screen gate component that prompts users to enter their Gemini API key.
// ABOUTME: Validates the key via a lightweight API call before saving to localStorage.

import { KeyRound, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { validateApiKey } from "../engine/gemini";

interface ApiKeyGateProps {
  onKeyValidated: (key: string) => void;
}

export function ApiKeyGate({ onKeyValidated }: ApiKeyGateProps) {
  const [inputValue, setInputValue] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      const key = inputValue.trim();
      if (!key) return;

      setValidating(true);
      setError(null);

      const valid = await validateApiKey(key);
      setValidating(false);

      if (valid) {
        onKeyValidated(key);
      } else {
        setError("Invalid API key. Please check and try again.");
      }
    },
    [inputValue, onKeyValidated],
  );

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-redact/10 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-redact" />
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">Connect your Gemini API key</h2>
          <p className="text-sm text-text-sub text-center leading-relaxed">
            Your key stays in this browser. No data touches our servers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
              }}
              placeholder="AIza..."
              autoComplete="off"
              className={`w-full px-4 py-3 rounded-lg bg-surface border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-redact/50 transition-colors ${
                error ? "border-redact" : "border-border"
              }`}
            />
            {error && <p className="mt-2 text-xs text-redact">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={validating || !inputValue.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-redact hover:bg-redact-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {validating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Validate & Save"
            )}
          </button>
        </form>

        <p className="mt-6 text-xs text-text-dim text-center">
          Get a free API key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-redact hover:underline"
          >
            Google AI Studio
          </a>
        </p>
      </div>
    </div>
  );
}
