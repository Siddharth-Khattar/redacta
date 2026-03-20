// ABOUTME: Modal dialog for managing per-provider API keys (add, change, remove).
// ABOUTME: Accessible from the header at any point; supports all registered providers.

import { Check, KeyRound, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProvider, PROVIDERS } from "../engine/providers/registry";
import type { ProviderConfig, ProviderId } from "../engine/providers/types";
import type { ProviderKeys } from "../hooks/useProviderKeys";

interface ApiKeyModalProps {
  keys: ProviderKeys;
  onKeyChanged: (provider: ProviderId, key: string) => void;
  onKeyClear: (provider: ProviderId) => void;
  onClose: () => void;
}

/** Mask an API key, showing only the first 4 and last 4 characters. */
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(Math.min(key.length - 8, 16))}${key.slice(-4)}`;
}

interface RowState {
  editing: boolean;
  inputValue: string;
  validating: boolean;
  error: string | null;
  confirmRemove: boolean;
}

type AllRowStates = Record<ProviderId, RowState>;

function initialRowStates(): AllRowStates {
  return {
    gemini: {
      editing: false,
      inputValue: "",
      validating: false,
      error: null,
      confirmRemove: false,
    },
    openai: {
      editing: false,
      inputValue: "",
      validating: false,
      error: null,
      confirmRemove: false,
    },
  };
}

function ProviderRow({
  config,
  currentKey,
  state,
  onStartEdit,
  onCancelEdit,
  onInputChange,
  onValidate,
  onRemove,
}: {
  config: ProviderConfig;
  currentKey: string | null;
  state: RowState;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onInputChange: (value: string) => void;
  onValidate: () => void;
  onRemove: () => void;
}) {
  const isConfigured = currentKey !== null && currentKey !== "";
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (state.editing) {
      inputRef.current?.focus();
    }
  }, [state.editing]);

  return (
    <div className="space-y-3">
      {/* Provider header row */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-text">{config.name}</span>
          {isConfigured && !state.editing ? (
            <span className="block text-xs text-text-dim font-mono mt-0.5">
              {maskKey(currentKey)}
            </span>
          ) : !isConfigured && !state.editing ? (
            <span className="block text-xs text-text-faint mt-0.5">Not configured</span>
          ) : null}
        </div>

        {!state.editing && (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-redact hover:bg-surface transition-colors"
          >
            {isConfigured ? (
              "Change"
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add
              </>
            )}
          </button>
        )}
      </div>

      {/* Inline edit form */}
      {state.editing && (
        <div className="space-y-2.5">
          <div>
            <input
              ref={inputRef}
              type="password"
              value={state.inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={config.keyPlaceholder}
              autoComplete="off"
              className={`w-full px-3 py-2 rounded-lg bg-surface border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-redact/50 transition-colors ${
                state.error ? "border-redact" : "border-border"
              }`}
            />
            {state.error && <p className="mt-1.5 text-xs text-redact">{state.error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onValidate}
              disabled={state.validating || !state.inputValue.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-redact hover:bg-redact-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              {state.validating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Validate & Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-2 rounded-lg text-xs font-medium text-text-dim hover:text-text hover:bg-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Remove button */}
      {isConfigured && !state.editing && (
        <button
          type="button"
          onClick={onRemove}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            state.confirmRemove ? "text-redact font-medium" : "text-text-dim hover:text-redact"
          }`}
        >
          <Trash2 className="w-3 h-3" />
          {state.confirmRemove ? "Click again to confirm removal" : "Remove"}
        </button>
      )}
    </div>
  );
}

export function ApiKeyModal({ keys, onKeyChanged, onKeyClear, onClose }: ApiKeyModalProps) {
  const [rowStates, setRowStates] = useState<AllRowStates>(initialRowStates);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  const updateRow = useCallback((id: ProviderId, patch: Partial<RowState>) => {
    setRowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const handleStartEdit = useCallback(
    (id: ProviderId) => {
      updateRow(id, { editing: true, inputValue: "", error: null, confirmRemove: false });
    },
    [updateRow],
  );

  const handleCancelEdit = useCallback(
    (id: ProviderId) => {
      updateRow(id, { editing: false, inputValue: "", error: null, validating: false });
    },
    [updateRow],
  );

  const handleInputChange = useCallback(
    (id: ProviderId, value: string) => {
      updateRow(id, { inputValue: value, error: null });
    },
    [updateRow],
  );

  const handleValidate = useCallback(
    async (id: ProviderId) => {
      const key = rowStates[id].inputValue.trim();
      if (!key) return;

      updateRow(id, { validating: true, error: null });

      const provider = getProvider(id);
      const valid = await provider.validateApiKey(key);

      if (valid) {
        onKeyChanged(id, key);
        updateRow(id, { editing: false, inputValue: "", validating: false, error: null });
      } else {
        updateRow(id, { validating: false, error: "Invalid API key. Please check and try again." });
      }
    },
    [rowStates, onKeyChanged, updateRow],
  );

  const handleRemove = useCallback(
    (id: ProviderId) => {
      if (!rowStates[id].confirmRemove) {
        updateRow(id, { confirmRemove: true });
        return;
      }
      onKeyClear(id);
      updateRow(id, { confirmRemove: false, editing: false, inputValue: "", error: null });
    },
    [rowStates, onKeyClear, updateRow],
  );

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
        <div className="px-6 py-5 space-y-5 divide-y divide-border">
          {PROVIDERS.map((config) => (
            <div key={config.id} className={config.id !== "gemini" ? "pt-5" : ""}>
              <ProviderRow
                config={config}
                currentKey={keys[config.id]}
                state={rowStates[config.id]}
                onStartEdit={() => handleStartEdit(config.id)}
                onCancelEdit={() => handleCancelEdit(config.id)}
                onInputChange={(value) => handleInputChange(config.id, value)}
                onValidate={() => handleValidate(config.id)}
                onRemove={() => handleRemove(config.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
