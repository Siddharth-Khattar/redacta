// ABOUTME: Redaction prompt input panel with model/thinking selectors and permanent toggle.
// ABOUTME: Clean form layout with warm colors and readable text sizes.

import { Info } from "lucide-react";
import { useState } from "react";
import {
  GEMINI_MODELS,
  type GeminiModel,
  getDefaultThinkingLevel,
  getSupportedThinkingLevels,
  THINKING_LEVELS,
  type ThinkingLevel,
} from "../api/redaction";

interface PromptPanelProps {
  onSubmit: (
    prompt: string,
    permanent: boolean,
    model: GeminiModel,
    thinkingLevel: ThinkingLevel,
  ) => void;
}

export function PromptPanel({ onSubmit }: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [permanent, setPermanent] = useState(false);
  const [model, setModel] = useState<GeminiModel>("gemini-2.0-flash");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>("low");
  const [showTooltip, setShowTooltip] = useState(false);

  const supportedLevels = getSupportedThinkingLevels(model);
  const supportsThinking = supportedLevels.length > 0;

  const handleModelChange = (newModel: GeminiModel) => {
    setModel(newModel);
    const newSupported = getSupportedThinkingLevels(newModel);
    if (newSupported.length > 0 && !newSupported.includes(thinkingLevel)) {
      setThinkingLevel(getDefaultThinkingLevel(newModel));
    }
  };

  const handleSubmit = () => {
    if (prompt.trim()) {
      onSubmit(prompt.trim(), permanent, model, thinkingLevel);
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
            What should we redact?
          </h3>
          <p className="text-sm text-text-dim">Describe the sensitive content in plain language</p>
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Redact all personal names, phone numbers, and email addresses..."
          className="w-full h-28 px-4 py-3 rounded-xl border border-border bg-bg text-text text-sm placeholder:text-text-faint focus:outline-none focus:border-text-dim resize-none leading-relaxed transition-colors"
          autoFocus
        />

        {/* Settings */}
        <div className="mt-5 space-y-4">
          {/* Model */}
          <div>
            <p className="text-xs font-medium text-text-dim mb-2">Model</p>
            <div className="flex gap-1.5">
              {GEMINI_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModelChange(m.id)}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      model === m.id
                        ? "bg-surface text-text shadow-sm ring-1 ring-border"
                        : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                    }
                  `}
                >
                  {m.label.replace("Gemini ", "")}
                </button>
              ))}
            </div>
          </div>

          {/* Thinking */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-medium text-text-dim">Thinking</p>
              {!supportsThinking && (
                <span className="text-[11px] text-text-faint">— not available for 2.x</span>
              )}
            </div>
            <div
              className={`flex gap-1.5 ${!supportsThinking ? "opacity-35 pointer-events-none" : ""}`}
            >
              {THINKING_LEVELS.filter((t) => supportedLevels.includes(t.id)).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThinkingLevel(t.id)}
                  disabled={!supportsThinking}
                  className={`
                    flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      thinkingLevel === t.id && supportsThinking
                        ? "bg-surface text-text shadow-sm ring-1 ring-border"
                        : "text-text-dim hover:text-text-sub hover:bg-surface-hover"
                    }
                  `}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Permanent toggle */}
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
                      boxes over text. The underlying data stays in the PDF and could be recovered.
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
                ? "bg-redact hover:bg-redact-hover text-white cursor-pointer shadow-sm"
                : "bg-border text-text-faint cursor-not-allowed"
            }
          `}
        >
          Redact Document
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
