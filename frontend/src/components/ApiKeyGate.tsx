// ABOUTME: Full-screen gate component that prompts users to configure at least one AI provider.
// ABOUTME: Validates keys per-provider via the registry and allows continuing once any provider is connected.

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { getProvider, PROVIDERS } from "../engine/providers/registry";
import type { ProviderConfig, ProviderId } from "../engine/providers/types";
import { RedactaLogo } from "./RedactaLogo";

interface ApiKeyGateProps {
  onKeysConfigured: () => void;
  setKey: (provider: ProviderId, key: string) => void;
}

interface CardState {
  inputValue: string;
  validating: boolean;
  error: string | null;
  isConfigured: boolean;
}

type AllCardStates = Record<ProviderId, CardState>;

function initialCardStates(): AllCardStates {
  return {
    gemini: { inputValue: "", validating: false, error: null, isConfigured: false },
    openai: { inputValue: "", validating: false, error: null, isConfigured: false },
  };
}

function ProviderCard({
  config,
  state,
  onInputChange,
  onValidate,
}: {
  config: ProviderConfig;
  state: CardState;
  onInputChange: (value: string) => void;
  onValidate: () => void;
}) {
  if (state.isConfigured) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text">{config.name}</span>
          <div className="flex items-center gap-1.5 text-emerald-500">
            <Check className="w-4 h-4" />
            <span className="text-xs font-medium">Connected</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <span className="block text-sm font-medium text-text">{config.name}</span>

      <div>
        <input
          type="password"
          value={state.inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={config.keyPlaceholder}
          autoComplete="off"
          className={`w-full px-3 py-2.5 rounded-lg bg-raised border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-redact/50 transition-colors ${
            state.error ? "border-redact" : "border-border"
          }`}
        />
        {state.error && <p className="mt-1.5 text-xs text-redact">{state.error}</p>}
      </div>

      <button
        type="button"
        onClick={onValidate}
        disabled={state.validating || !state.inputValue.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-redact hover:bg-redact-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {state.validating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Validating...
          </>
        ) : (
          "Validate & Save"
        )}
      </button>

      <p className="text-xs text-text-dim">
        Get a key from{" "}
        <a
          href={config.keyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-redact hover:underline"
        >
          {config.keyUrlLabel}
          <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}

export function ApiKeyGate({ onKeysConfigured, setKey }: ApiKeyGateProps) {
  const [cardStates, setCardStates] = useState<AllCardStates>(initialCardStates);

  const configuredCount = PROVIDERS.filter((p) => cardStates[p.id].isConfigured).length;

  const updateCard = useCallback((id: ProviderId, patch: Partial<CardState>) => {
    setCardStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }, []);

  const handleInputChange = useCallback(
    (id: ProviderId, value: string) => {
      updateCard(id, { inputValue: value, error: null });
    },
    [updateCard],
  );

  const handleValidate = useCallback(
    async (id: ProviderId) => {
      const key = cardStates[id].inputValue.trim();
      if (!key) return;

      updateCard(id, { validating: true, error: null });

      const provider = getProvider(id);
      const valid = await provider.validateApiKey(key);

      if (valid) {
        setKey(id, key);
        updateCard(id, { validating: false, isConfigured: true, inputValue: "", error: null });
      } else {
        updateCard(id, {
          validating: false,
          error: "Invalid API key. Please check and try again.",
        });
      }
    },
    [cardStates, setKey, updateCard],
  );

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <RedactaLogo size={48} className="text-text" />
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">Connect your AI providers</h2>
          <p className="text-sm text-text-sub text-center leading-relaxed">
            Your keys stay in this browser. No data touches our servers.
          </p>
        </div>

        {/* Provider cards */}
        <div className="space-y-3">
          {PROVIDERS.map((config) => (
            <ProviderCard
              key={config.id}
              config={config}
              state={cardStates[config.id]}
              onInputChange={(value) => handleInputChange(config.id, value)}
              onValidate={() => handleValidate(config.id)}
            />
          ))}
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={onKeysConfigured}
          disabled={configuredCount === 0}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-redact hover:bg-redact-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
