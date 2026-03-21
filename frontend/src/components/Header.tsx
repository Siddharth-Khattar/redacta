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
        <a
          href="https://ko-fi.com/siddharthkhattar"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF5E5B] hover:bg-[#e04e4b] text-white transition-colors"
          title="Support on Ko-fi"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
            <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-2.792-2.481-4.03-3.976c-1.03-1.241-.846-3.029.388-3.736 1.236-.707 2.987-.188 3.642 1.035.656-1.223 2.407-1.742 3.643-1.035 1.233.707 1.418 2.495.368 3.736z" />
          </svg>
          <span className="hidden sm:inline">Ko-fi</span>
        </a>
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
