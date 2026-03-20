// ABOUTME: Redaction prompt input panel with provider/model/thinking selectors and permanent toggle.
// ABOUTME: Clean form layout with warm colors and readable text sizes.

import { Info } from "lucide-react";
import { useState } from "react";
import type { HighlightColor, ProcessingMode } from "../api/redaction";
import {
  getDefaultThinkingLevel,
  getModelDefinition,
  getModelsForProvider,
} from "../engine/providers/registry";
import type { ProviderId, ThinkingLevel } from "../engine/providers/types";

const HIGHLIGHT_COLORS: { value: HighlightColor; bg: string; ring: string }[] = [
  { value: "white", bg: "bg-white", ring: "ring-white" },
  { value: "blue", bg: "bg-blue-400", ring: "ring-blue-400" },
  { value: "green", bg: "bg-green-400", ring: "ring-green-400" },
  { value: "yellow", bg: "bg-yellow-300", ring: "ring-yellow-300" },
  { value: "pink", bg: "bg-pink-400", ring: "ring-pink-400" },
  { value: "purple", bg: "bg-purple-400", ring: "ring-purple-400" },
];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
};

const PROVIDER_PREFIXES: Record<ProviderId, string> = {
  gemini: "Gemini ",
  openai: "GPT-",
};

/** Strip the provider-specific prefix from a model label to produce a short display name. */
function shortModelLabel(label: string, provider: ProviderId): string {
  const prefix = PROVIDER_PREFIXES[provider];
  if (label.startsWith(prefix)) {
    return label.slice(prefix.length);
  }
  return label;
}

interface PromptPanelProps {
  configuredProviders: ProviderId[];
  onSubmit: (
    prompt: string,
    mode: ProcessingMode,
    permanent: boolean,
    providerId: ProviderId,
    modelId: string,
    thinkingLevel: string,
    highlightColor: HighlightColor,
  ) => void;
}

export function PromptPanel({ configuredProviders, onSubmit }: PromptPanelProps) {
  const initialProvider = configuredProviders[0]!;
  const initialModels = getModelsForProvider(initialProvider);
  const initialModel = initialModels[0]!;

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ProcessingMode>("redact");
  const [permanent, setPermanent] = useState(false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("white");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(initialProvider);
  const [selectedModel, setSelectedModel] = useState(initialModel.id);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(
    getDefaultThinkingLevel(initialModel.id),
  );
  const [showTooltip, setShowTooltip] = useState(false);

  const providerModels = getModelsForProvider(selectedProvider);
  const modelDef = getModelDefinition(selectedModel);
  const supportedLevels = modelDef?.thinkingLevels ?? [];
  const supportsThinking = supportedLevels.length > 0;

  const handleProviderChange = (provider: ProviderId) => {
    setSelectedProvider(provider);
    const models = getModelsForProvider(provider);
    const firstModel = models[0]!;
    setSelectedModel(firstModel.id);
    setThinkingLevel(getDefaultThinkingLevel(firstModel.id));
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    const def = getModelDefinition(modelId);
    const newLevels = def?.thinkingLevels ?? [];
    if (newLevels.length > 0 && !newLevels.includes(thinkingLevel)) {
      setThinkingLevel(getDefaultThinkingLevel(modelId));
    }
  };

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(
        prompt.trim(),
        mode,
        permanent,
        selectedProvider,
        selectedModel,
        thinkingLevel,
        highlightColor,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && prompt.trim()) {
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        {/* Heading */}
        <div className="mb-5">
          <h3 className="text-xl font-semibold text-text mb-1 tracking-tight">
            {mode === "redact" ? "What should we redact?" : "What should we pseudonymise?"}
          </h3>
          <p className="text-sm text-text-dim">Describe the sensitive content in plain language</p>
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "redact"
              ? "Redact all personal names, phone numbers, and email addresses..."
              : "Pseudonymise all personal names, phone numbers, and email addresses..."
          }
          className="w-full h-28 px-4 py-3 rounded-xl border border-border bg-bg text-text text-sm placeholder:text-text-faint focus:outline-none focus:border-text-dim resize-none leading-relaxed transition-colors"
          autoFocus
        />

        {/* Settings */}
        <div className="mt-5 space-y-4">
          {/* Mode toggle */}
          <div>
            <p className="text-xs font-medium text-text-dim mb-2">Mode</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMode("redact")}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                  ${
                    mode === "redact"
                      ? "bg-redact-soft text-redact shadow-sm ring-1 ring-redact/20"
                      : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                  }
                `}
              >
                Redact
              </button>
              <button
                type="button"
                onClick={() => setMode("pseudonymise")}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                  ${
                    mode === "pseudonymise"
                      ? "bg-pseudo-soft text-pseudo shadow-sm ring-1 ring-pseudo/20"
                      : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                  }
                `}
              >
                Pseudonymise
              </button>
            </div>
          </div>

          {/* Provider */}
          <div>
            <p className="text-xs font-medium text-text-dim mb-2">Provider</p>
            <div className="flex gap-1.5">
              {configuredProviders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      selectedProvider === p
                        ? "bg-surface text-text shadow-sm ring-1 ring-border"
                        : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                    }
                  `}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <p className="text-xs font-medium text-text-dim mb-2">Model</p>
            <div className="flex gap-1.5">
              {providerModels.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModelChange(m.id)}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      selectedModel === m.id
                        ? "bg-surface text-text shadow-sm ring-1 ring-border"
                        : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                    }
                  `}
                >
                  {shortModelLabel(m.label, selectedProvider)}
                </button>
              ))}
            </div>
          </div>

          {/* Thinking */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-medium text-text-dim">Thinking</p>
              {!supportsThinking && (
                <span className="text-[11px] text-text-faint">— not available for this model</span>
              )}
            </div>
            <div
              className={`flex gap-1.5 ${!supportsThinking ? "opacity-35 pointer-events-none" : ""}`}
            >
              {supportedLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setThinkingLevel(level)}
                  disabled={!supportsThinking}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      thinkingLevel === level && supportsThinking
                        ? "bg-surface text-text shadow-sm ring-1 ring-border"
                        : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                    }
                  `}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Permanent toggle — redact mode only */}
          {mode === "redact" && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 relative">
                  <p className="text-xs font-medium text-text-dim">Permanent removal</p>
                  <button
                    type="button"
                    className="text-text-faint hover:text-text-dim transition-colors"
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    onClick={() => setShowTooltip((v) => !v)}
                    aria-label="More info about permanent removal"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  {showTooltip && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 p-3.5 rounded-xl bg-surface border border-border shadow-2xl text-xs text-text-sub leading-relaxed z-20">
                      <p className="mb-2">
                        <strong className="text-text">Visual covering</strong> (default) draws black
                        boxes over text. The underlying data stays in the PDF and could be
                        recovered.
                      </p>
                      <p>
                        <strong className="text-redact">Permanent removal</strong> deletes the text
                        data entirely. Characters are destroyed, not hidden. This cannot be undone.
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={permanent}
                  onClick={() => setPermanent(!permanent)}
                  className={`
                    relative w-10 h-5.5 rounded-full transition-colors duration-200
                    ${permanent ? "bg-redact" : "bg-border"}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.75 left-0.75 w-4 h-4 rounded-full bg-white
                      transition-transform duration-200 shadow-sm
                      ${permanent ? "translate-x-4.5" : "translate-x-0"}
                    `}
                  />
                </button>
              </div>
              {permanent && (
                <p className="text-xs text-redact/70 mt-1.5 leading-relaxed">
                  Text beneath redactions will be permanently destroyed.
                </p>
              )}
            </div>
          )}

          {/* Highlight color picker — pseudonymise mode only */}
          {mode === "pseudonymise" && (
            <div>
              <p className="text-xs font-medium text-text-dim mb-2">Highlight color</p>
              <div className="flex items-center gap-2">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setHighlightColor(c.value)}
                    aria-label={`Highlight color: ${c.value}`}
                    className={`
                      w-7 h-7 rounded-full ${c.bg} transition-all duration-150
                      ${
                        highlightColor === c.value
                          ? `ring-2 ${c.ring} ring-offset-2 ring-offset-bg`
                          : "hover:scale-110"
                      }
                    `}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className={`
            mt-6 w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200
            ${
              prompt.trim()
                ? mode === "redact"
                  ? "bg-redact hover:bg-redact-hover text-white cursor-pointer shadow-sm"
                  : "bg-pseudo hover:bg-pseudo-hover text-white cursor-pointer shadow-sm"
                : "bg-border text-text-faint cursor-not-allowed"
            }
          `}
        >
          {mode === "redact" ? "Redact Document" : "Pseudonymise Document"}
        </button>

        <p className="text-center mt-3 text-xs text-text-faint">
          <kbd className="px-1.5 py-0.5 rounded-md bg-surface text-text-dim border border-border text-[11px]">
            Cmd + Enter
          </kbd>
        </p>
      </div>
    </div>
  );
}
