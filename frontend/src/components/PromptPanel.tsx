// ABOUTME: Redaction prompt input panel with provider/model/thinking selectors and permanent toggle.
// ABOUTME: Clean form layout with warm colors and readable text sizes.

import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { HighlightColor, ProcessingMode } from "../api/redaction";
import { getPresetById, REDACTION_PRESETS } from "../engine/presets";
import {
  getDefaultThinkingLevel,
  getModelDefinition,
  getModelsForProvider,
} from "../engine/providers/registry";
import type { ProviderId, ThinkingLevel } from "../engine/providers/types";

const SETTINGS_KEY = "redacta-settings";

interface StoredSettings {
  mode?: ProcessingMode;
  provider?: ProviderId;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  highlightColor?: HighlightColor;
  redactImages?: boolean;
}

function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredSettings;
  } catch {
    return {};
  }
}

function saveSettings(settings: StoredSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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
    redactImages: boolean,
    thorough: boolean,
    presetId: string | null,
  ) => void;
}

export function PromptPanel({ configuredProviders, onSubmit }: PromptPanelProps) {
  const fallbackProvider = configuredProviders[0]!;
  const stored = loadSettings();

  // Resolve provider: use stored if still configured, otherwise fall back
  const resolvedProvider =
    stored.provider && configuredProviders.includes(stored.provider)
      ? stored.provider
      : fallbackProvider;

  // Resolve model: use stored if still available for the provider, otherwise first model
  const resolvedModels = getModelsForProvider(resolvedProvider);
  const resolvedModel =
    stored.model && resolvedModels.some((m) => m.id === stored.model)
      ? stored.model
      : resolvedModels[0]!.id;

  // Resolve thinking level: use stored if valid for the model, otherwise default
  const resolvedModelDef = getModelDefinition(resolvedModel);
  const resolvedThinking: ThinkingLevel =
    stored.thinkingLevel && (resolvedModelDef?.thinkingLevels ?? []).includes(stored.thinkingLevel)
      ? stored.thinkingLevel
      : getDefaultThinkingLevel(resolvedModel);

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ProcessingMode>(stored.mode ?? "redact");
  const permanent = true;
  const [redactImages, setRedactImages] = useState(stored.redactImages ?? false);
  const [highlightColor, setHighlightColor] = useState<HighlightColor>(
    stored.highlightColor ?? "white",
  );
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(resolvedProvider);
  const [selectedModel, setSelectedModel] = useState(resolvedModel);
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(resolvedThinking);

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Persist settings on change
  useEffect(() => {
    saveSettings({
      mode,
      provider: selectedProvider,
      model: selectedModel,
      thinkingLevel,
      highlightColor,
      redactImages,
    });
  }, [mode, selectedProvider, selectedModel, thinkingLevel, highlightColor, redactImages]);

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

  const canSubmit = prompt.trim() || redactImages;

  const handleSubmit = () => {
    if (canSubmit) {
      const thorough = activePreset ? (getPresetById(activePreset)?.thorough ?? false) : false;
      onSubmit(
        prompt.trim(),
        mode,
        permanent,
        selectedProvider,
        selectedModel,
        thinkingLevel,
        highlightColor,
        redactImages,
        thorough,
        activePreset,
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full pt-10">
        {/* Heading */}
        <div className="mb-6">
          <h3 className="text-2xl font-semibold text-text mb-1.5 tracking-tight">
            {mode === "redact" ? "What should we redact?" : "What should we pseudonymise?"}
          </h3>
          <p className="text-base text-text-dim">
            Describe the sensitive content in plain language
          </p>
        </div>

        {/* Preset chips */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {REDACTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => {
                setPrompt(preset.prompt);
                setActivePreset(preset.id);
              }}
              className={`
                px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150
                ${
                  activePreset === preset.id
                    ? mode === "redact"
                      ? "bg-redact/10 text-redact ring-1 ring-redact/30"
                      : "bg-pseudo/10 text-pseudo ring-1 ring-pseudo/30"
                    : "bg-surface text-text-dim hover:text-text-sub hover:bg-surface-hover"
                }
              `}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setActivePreset(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "redact"
              ? "Redact all personal names, phone numbers, and email addresses..."
              : "Pseudonymise all personal names, phone numbers, and email addresses..."
          }
          className="w-full h-32 px-4 py-3.5 rounded-xl border border-border bg-bg text-text text-base placeholder:text-text-faint focus:outline-none focus:border-text-dim resize-none leading-relaxed transition-colors"
          autoFocus
        />

        {/* Settings */}
        <div className="mt-6 space-y-5">
          {/* Mode toggle */}
          <div>
            <p className="text-sm font-medium text-text-dim mb-2.5">Mode</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("redact")}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
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
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
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

          {/* Model settings — summary line + collapsible panel */}
          <div>
            <button
              type="button"
              onClick={() => setShowModelSettings((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
            >
              <span className="text-sm text-text-sub">
                {PROVIDER_LABELS[selectedProvider]}
                <span className="text-text-faint mx-1.5">&middot;</span>
                {modelDef?.label ?? selectedModel}
                {supportsThinking && (
                  <>
                    <span className="text-text-faint mx-1.5">&middot;</span>
                    {thinkingLevel.charAt(0).toUpperCase() + thinkingLevel.slice(1)} thinking
                  </>
                )}
              </span>
              {showModelSettings ? (
                <ChevronUp className="w-4 h-4 text-text-faint" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-faint" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {showModelSettings && (
                <motion.div
                  key="model-settings"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-1 space-y-4 pl-1">
                    {/* Provider */}
                    <div>
                      <p className="text-sm font-medium text-text-dim mb-2.5">Provider</p>
                      <div className="flex gap-2">
                        {configuredProviders.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleProviderChange(p)}
                            className={`
                              flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
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
                      <p className="text-sm font-medium text-text-dim mb-2.5">Model</p>
                      <div className="flex gap-2">
                        {providerModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleModelChange(m.id)}
                            className={`
                              flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
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
                      <div className="flex items-center gap-2 mb-2.5">
                        <p className="text-sm font-medium text-text-dim">Thinking</p>
                        {!supportsThinking && (
                          <span className="text-xs text-text-faint">
                            — not available for this model
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex gap-2 ${!supportsThinking ? "opacity-35 pointer-events-none" : ""}`}
                      >
                        {supportedLevels.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setThinkingLevel(level)}
                            disabled={!supportsThinking}
                            className={`
                              flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Highlight color picker — pseudonymise mode only */}
          {mode === "pseudonymise" && (
            <div>
              <p className="text-sm font-medium text-text-dim mb-2.5">Highlight color</p>
              <div className="flex items-center gap-2.5">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setHighlightColor(c.value)}
                    aria-label={`Highlight color: ${c.value}`}
                    className={`
                      w-8 h-8 rounded-full ${c.bg} transition-all duration-150
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

          {/* Redact images toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-dim">Remove images</p>
            <button
              type="button"
              role="switch"
              aria-checked={redactImages}
              onClick={() => setRedactImages(!redactImages)}
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200
                ${redactImages ? (mode === "pseudonymise" ? "bg-pseudo" : "bg-redact") : "bg-border"}
              `}
            >
              <span
                className={`
                  absolute top-0.75 left-0.75 w-4.5 h-4.5 rounded-full bg-white
                  transition-transform duration-200 shadow-sm
                  ${redactImages ? "translate-x-5" : "translate-x-0"}
                `}
              />
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`
            mt-8 w-full py-3.5 rounded-xl text-base font-semibold transition-all duration-200
            ${
              canSubmit
                ? mode === "redact"
                  ? "bg-redact hover:bg-redact-hover text-white cursor-pointer shadow-sm"
                  : "bg-pseudo hover:bg-pseudo-hover text-white cursor-pointer shadow-sm"
                : "bg-border text-text-faint cursor-not-allowed"
            }
          `}
        >
          {!prompt.trim() && redactImages
            ? "Remove Images"
            : mode === "redact"
              ? "Redact Document"
              : "Pseudonymise Document"}
        </button>

        <p className="text-center mt-3 text-sm text-text-faint">
          <kbd className="px-1.5 py-0.5 rounded-md bg-surface text-text-dim border border-border text-xs">
            Cmd + Enter
          </kbd>
        </p>
      </div>
    </div>
  );
}
