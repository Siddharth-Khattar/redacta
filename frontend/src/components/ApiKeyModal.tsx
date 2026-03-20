// ABOUTME: Modal dialog for changing or clearing the Gemini API key.
// ABOUTME: Accessible from the header at any point in the app flow.

import { KeyRound, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { validateApiKey } from "../engine/gemini";

interface ApiKeyModalProps {
  currentKeyHint: string;
  onKeyChanged: (key: string) => void;
  onKeyClear: () => void;
  onClose: () => void;
}

/** Mask an API key, showing only the first 4 and last 4 characters. */
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 16))}${key.slice(-4)}`;
}

export function ApiKeyModal({
  currentKeyHint,
  onKeyChanged,
  onKeyClear,
  onClose,
}: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

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
        onKeyChanged(key);
      } else {
        setError("Invalid API key. Please check and try again.");
      }
    },
    [inputValue, onKeyChanged],
  );

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onKeyClear();
  }, [confirmClear, onKeyClear]);

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="API Key Settings"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="w-full max-w-md mx-4 rounded-xl bg-raised border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-redact" />
            <h2 className="text-sm font-semibold text-text">API Key Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-text-dim hover:text-text hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Current key display */}
          <div>
            <span className="block text-xs font-medium text-text-sub mb-1.5">Current key</span>
            <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-text-dim font-mono">
              {maskKey(currentKeyHint)}
            </div>
          </div>

          {/* New key form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="new-api-key"
                className="block text-xs font-medium text-text-sub mb-1.5"
              >
                New key
              </label>
              <input
                ref={inputRef}
                id="new-api-key"
                type="password"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                placeholder="AIza..."
                autoComplete="off"
                className={`w-full px-3 py-2 rounded-lg bg-surface border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-redact/50 transition-colors ${
                  error ? "border-redact" : "border-border"
                }`}
              />
              {error && <p className="mt-1.5 text-xs text-redact">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={validating || !inputValue.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-redact hover:bg-redact-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
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
        </div>

        {/* Footer — clear key */}
        <div className="px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleClear}
            className={`flex items-center gap-2 text-xs transition-colors ${
              confirmClear ? "text-redact font-medium" : "text-text-dim hover:text-redact"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmClear ? "Click again to confirm removal" : "Remove API key"}
          </button>
        </div>
      </div>
    </div>
  );
}
