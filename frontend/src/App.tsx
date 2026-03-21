// ABOUTME: Root application component with state-machine driven flow.
// ABOUTME: Manages transitions between API key gate, upload, workspace, processing, result, and error states.

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type HighlightColor,
  type ImageRedactionSettings,
  type ProcessingMode,
  RATE_LIMIT_ERROR_MESSAGE,
  type RedactionResponse,
  reapplySettings,
  redactPdf,
} from "./api/redaction";
import { ApiKeyGate } from "./components/ApiKeyGate";
import { ApiKeyModal } from "./components/ApiKeyModal";
import { DownloadBar } from "./components/DownloadBar";
import { Header } from "./components/Header";
import { PdfPanel } from "./components/PdfPanel";
import { ProcessingPanel } from "./components/ProcessingPanel";
import { PromptPanel } from "./components/PromptPanel";
import { RedactionWorkspace } from "./components/RedactionWorkspace";
import { ResultPanel } from "./components/ResultPanel";
import { ScanOverlay } from "./components/ScanOverlay";
import { UploadZone } from "./components/UploadZone";
import type { ProviderId } from "./engine/providers/types";
import { RedactionEngineError } from "./engine/types";
import { useProviderKeys } from "./hooks/useProviderKeys";

type AppState = "upload" | "workspace" | "processing" | "result" | "error";
type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("redacta-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const { keys, hasAnyKey, configuredProviders, setKey, clearKey } = useProviderKeys();
  const [gatePassed, setGatePassed] = useState(hasAnyKey);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [state, setState] = useState<AppState>("upload");
  const [lastMode, setLastMode] = useState<ProcessingMode>("redact");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RedactionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("redacta-theme", theme);
  }, [theme]);

  // Reset to gate when all keys are removed (e.g. via the modal)
  useEffect(() => {
    if (!hasAnyKey && gatePassed) {
      abortControllerRef.current?.abort();
      setGatePassed(false);
      setState("upload");
      setFile(null);
      setResult(null);
      setErrorMessage(null);
      setShowApiKeyModal(false);
    }
  }, [hasAnyKey, gatePassed]);

  const handleToggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const handleFileAccepted = useCallback((accepted: File) => {
    setFile(accepted);
    setState("workspace");
    setResult(null);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(
    async (
      prompt: string,
      mode: ProcessingMode,
      permanent: boolean,
      providerId: ProviderId,
      modelId: string,
      thinkingLevel: string,
      highlightColor: HighlightColor,
      redactImages: boolean,
    ) => {
      const apiKey = keys[providerId];
      if (!file || !apiKey) return;

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLastMode(mode);
      setState("processing");
      setErrorMessage(null);

      try {
        const response = await redactPdf(
          apiKey,
          file,
          prompt,
          permanent,
          providerId,
          modelId,
          thinkingLevel,
          mode,
          highlightColor,
          redactImages,
        );

        // Check if aborted during processing
        if (controller.signal.aborted) return;

        setResult(response);
        setState("result");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        // If API key is invalid, clear it and go back to gate
        if (error instanceof RedactionEngineError && error.code === "API_KEY_INVALID") {
          clearKey(providerId);
          return;
        }

        const message =
          error instanceof Error ? error.message : "An unexpected error occurred during redaction";
        setErrorMessage(message);
        setState("error");
      }
    },
    [file, keys, clearKey],
  );

  const handleRedactAgain = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
    setState("workspace");
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setState("workspace");
  }, []);

  /** Unified re-render handler for any post-processing visual change. */
  const handleRerender = useCallback(
    async (updates: {
      highlightColor?: HighlightColor;
      imageSettings?: ImageRedactionSettings;
    }) => {
      if (!file || !result) return;

      const color = updates.highlightColor ?? result.highlightColor;
      const imgSettings = updates.imageSettings ?? result.imageSettings;

      const newPdf = await reapplySettings(
        file,
        result.targets,
        result.mode,
        result.permanent,
        color,
        result.imageTargets,
        imgSettings,
      );

      setResult((prev) =>
        prev
          ? {
              ...prev,
              redacted_pdf: newPdf,
              highlightColor: color,
              imageSettings: imgSettings,
            }
          : prev,
      );
    },
    [file, result],
  );

  const handleKeyChanged = useCallback(
    (provider: ProviderId, key: string) => {
      setKey(provider, key);
      setShowApiKeyModal(false);
    },
    [setKey],
  );

  const isPostUpload = state !== "upload" && file;

  return (
    <div className="noise h-screen flex flex-col bg-bg">
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        apiKeySet={hasAnyKey}
        onApiKeyClick={() => setShowApiKeyModal(true)}
      />

      <AnimatePresence mode="wait">
        {!gatePassed && (
          <motion.div
            key="api-key-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <ApiKeyGate onKeysConfigured={() => setGatePassed(true)} setKey={setKey} />
          </motion.div>
        )}

        {gatePassed && state === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <UploadZone onFileAccepted={handleFileAccepted} />
          </motion.div>
        )}

        {gatePassed && isPostUpload && (
          <motion.div
            key="workspace-area"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <RedactionWorkspace
              left={
                <div ref={pdfPanelRef} className="relative w-full h-full">
                  <PdfPanel
                    file={file}
                    label={state === "result" ? `Original: ${file.name}` : file.name}
                    onFileChange={handleFileAccepted}
                  />
                  {state === "processing" && <ScanOverlay containerRef={pdfPanelRef} />}
                </div>
              }
              right={
                <>
                  {state === "workspace" && (
                    <PromptPanel
                      configuredProviders={configuredProviders}
                      onSubmit={handleSubmit}
                    />
                  )}
                  {state === "processing" && <ProcessingPanel mode={lastMode} />}
                  {state === "result" && result && (
                    <ResultPanel result={result} onRerender={handleRerender} />
                  )}
                  {state === "error" && (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center max-w-sm">
                        <div
                          className={`w-3 h-3 rounded-full mx-auto mb-5 ${lastMode === "pseudonymise" ? "bg-pseudo" : "bg-redact"}`}
                        />
                        <h3 className="text-lg font-semibold text-text mb-2">
                          {lastMode === "pseudonymise"
                            ? "Pseudonymisation failed"
                            : "Redaction failed"}
                        </h3>
                        <p className="text-sm text-text-sub mb-2 leading-relaxed">{errorMessage}</p>
                        {errorMessage === RATE_LIMIT_ERROR_MESSAGE && (
                          <p className="text-xs text-text-dim mb-6">
                            Usually resolves within a minute.
                          </p>
                        )}
                        {errorMessage !== RATE_LIMIT_ERROR_MESSAGE && <div className="mb-6" />}
                        <button
                          type="button"
                          onClick={handleRetry}
                          className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors ${
                            lastMode === "pseudonymise"
                              ? "bg-pseudo hover:bg-pseudo-hover"
                              : "bg-redact hover:bg-redact-hover"
                          }`}
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}
                </>
              }
            />
            {state === "result" && result && (
              <DownloadBar
                result={result}
                originalFileName={file.name}
                onRedactAgain={handleRedactAgain}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showApiKeyModal && hasAnyKey && (
        <ApiKeyModal
          keys={keys}
          onKeyChanged={handleKeyChanged}
          onKeyClear={clearKey}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </div>
  );
}
