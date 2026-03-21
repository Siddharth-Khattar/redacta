// ABOUTME: Root application component with hash-based routing via wouter.
// ABOUTME: Manages theme, API key modal, and route transitions between upload and workspace.

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Redirect, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { Header } from "./components/Header";
import type { ProviderId } from "./engine/providers/types";
import { useProviderKeys } from "./hooks/useProviderKeys";
import { clearPdf } from "./lib/pdf-store";
import { LandingPage } from "./pages/LandingPage";
import { WorkspacePage } from "./pages/WorkspacePage";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("redacta-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const VALID_ROUTES = new Set(["/", "/workspace"]);

function AppShell() {
  const { keys, hasAnyKey, configuredProviders, setKey, clearKey } = useProviderKeys();
  const [location, navigate] = useLocation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("redacta-theme", theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const handleLogoClick = useCallback(async () => {
    await clearPdf();
    navigate("/");
  }, [navigate]);

  const handleRequestApiKeyModal = useCallback(() => {
    setShowApiKeyModal(true);
  }, []);

  const handleKeyChanged = useCallback(
    (provider: ProviderId, key: string) => {
      setKey(provider, key);
      setShowApiKeyModal(false);
    },
    [setKey],
  );

  // Redirect unknown routes to home
  if (!VALID_ROUTES.has(location)) {
    return <Redirect to="/" replace />;
  }

  return (
    <div className="noise h-screen flex flex-col bg-bg">
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onApiKeyClick={handleRequestApiKeyModal}
        onLogoClick={handleLogoClick}
      />

      <AnimatePresence mode="wait">
        {location === "/" && <LandingPage key="landing" />}
        {location === "/workspace" && (
          <WorkspacePage
            key="workspace"
            keys={keys}
            hasAnyKey={hasAnyKey}
            configuredProviders={configuredProviders}
            clearKey={clearKey}
            onRequestApiKeyModal={handleRequestApiKeyModal}
          />
        )}
      </AnimatePresence>

      {showApiKeyModal && (
        <ApiKeyModal
          keys={keys}
          onKeyChanged={handleKeyChanged}
          onKeyClear={clearKey}
          onClose={hasAnyKey ? () => setShowApiKeyModal(false) : undefined}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <AppShell />
    </Router>
  );
}
