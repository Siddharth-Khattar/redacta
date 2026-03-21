// ABOUTME: App header with branding, theme toggle, and API key button.
// ABOUTME: Clean, minimal — bracket logo + wordmark.

import { KeyRound, Moon, Sun } from "lucide-react";
import { RedactaLogo } from "./RedactaLogo";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onApiKeyClick: () => void;
  onLogoClick: () => void;
}

export function Header({ theme, onToggleTheme, onApiKeyClick, onLogoClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-bg/80 backdrop-blur-md z-20 relative">
      <button
        type="button"
        onClick={onLogoClick}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="Back to home"
      >
        <RedactaLogo size={22} className="text-text" />
        <span className="text-base font-semibold text-text tracking-tight">Redacta</span>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onApiKeyClick}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim hover:text-redact hover:bg-surface transition-colors"
          aria-label="API keys"
          title="API keys"
        >
          <KeyRound className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-dim hover:text-text hover:bg-surface transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
