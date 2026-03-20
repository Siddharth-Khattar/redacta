// ABOUTME: App header with branding, theme toggle, and reset button.
// ABOUTME: Clean, minimal — dot accent + wordmark.

import { KeyRound, Moon, RotateCcw, Sun } from "lucide-react";

interface HeaderProps {
  showReset: boolean;
  onReset: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  apiKeySet: boolean;
  onApiKeyClick: () => void;
}

export function Header({
  showReset,
  onReset,
  theme,
  onToggleTheme,
  apiKeySet,
  onApiKeyClick,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-bg/80 backdrop-blur-md z-20 relative">
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-redact" />
        <span className="text-base font-semibold text-text tracking-tight">Redacta</span>
      </div>

      <div className="flex items-center gap-1">
        {apiKeySet && (
          <button
            type="button"
            onClick={onApiKeyClick}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim hover:text-redact hover:bg-surface transition-colors"
            aria-label="API key settings"
            title="API key settings"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim hover:text-text hover:bg-surface transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {showReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 px-3.5 py-1.5 text-sm text-text-sub hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New file
          </button>
        )}
      </div>
    </header>
  );
}
