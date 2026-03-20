// ABOUTME: Root application component with state-machine driven flow.
// ABOUTME: Manages transitions between API key gate, upload, workspace, processing, result, and error states.

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GeminiModel,
  RATE_LIMIT_ERROR_MESSAGE,
  type RedactionResponse,
  redactPdf,
  type ThinkingLevel,
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
import { RedactionEngineError } from "./engine/types";
import { useApiKey } from "./hooks/useApiKey";

type AppState = "upload" | "workspace" | "processing" | "result" | "error";
type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("redacta-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const { apiKey, hasApiKey, setApiKey, clearApiKey } = useApiKey();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [state, setState] = useState<AppState>("upload");
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
      permanent: boolean,
      model: GeminiModel,
      thinkingLevel: ThinkingLevel,
    ) => {
      if (!file || !apiKey) return;

      // Abort any previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState("processing");
      setErrorMessage(null);

      try {
        const response = await redactPdf(apiKey, file, prompt, permanent, model, thinkingLevel);

        // Check if aborted during processing
        if (controller.signal.aborted) return;

        setResult(response);
        setState("result");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

        // If API key is invalid, clear it and go back to gate
        if (error instanceof RedactionEngineError && error.code === "API_KEY_INVALID") {
          clearApiKey();
          return;
        }

        const message =
          error instanceof Error ? error.message : "An unexpected error occurred during redaction";
        setErrorMessage(message);
        setState("error");
      }
    },
    [file, apiKey, clearApiKey],
  );

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    setFile(null);
    setResult(null);
    setErrorMessage(null);
    setState("upload");
  }, []);

  const handleRedactAgain = useCallback(() => {
    setResult(null);
    setErrorMessage(null);
    setState("workspace");
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setState("workspace");
  }, []);

  const handleClearApiKey = useCallback(() => {
    abortControllerRef.current?.abort();
    clearApiKey();
    setShowApiKeyModal(false);
    setFile(null);
    setResult(null);
    setErrorMessage(null);
    setState("upload");
  }, [clearApiKey]);

  const handleApiKeyChanged = useCallback(
    (key: string) => {
      setApiKey(key);
      setShowApiKeyModal(false);
    },
    [setApiKey],
  );

  const isPostUpload = state !== "upload" && file;

  return (
    <div className="noise h-screen flex flex-col bg-bg">
      <Header
        showReset={state !== "upload"}
        onReset={handleReset}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        apiKeySet={hasApiKey}
        onApiKeyClick={() => setShowApiKeyModal(true)}
      />

      <AnimatePresence mode="wait">
        {!hasApiKey && (
          <motion.div
            key="api-key-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <ApiKeyGate onKeyValidated={setApiKey} />
          </motion.div>
        )}

        {hasApiKey && state === "upload" && (
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

        {hasApiKey && isPostUpload && (
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
                  />
                  {state === "processing" && <ScanOverlay containerRef={pdfPanelRef} />}
                </div>
              }
              right={
                <>
                  {state === "workspace" && <PromptPanel onSubmit={handleSubmit} />}
                  {state === "processing" && <ProcessingPanel />}
                  {state === "result" && result && <ResultPanel result={result} />}
                  {state === "error" && (
                    <div className="flex-1 flex items-center justify-center p-8">
                      <div className="text-center max-w-sm">
                        <div className="w-3 h-3 rounded-full bg-redact mx-auto mb-5" />
                        <h3 className="text-lg font-semibold text-text mb-2">Redaction failed</h3>
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
                          className="px-5 py-2.5 rounded-lg bg-redact hover:bg-redact-hover text-white text-sm font-medium transition-colors"
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

      {showApiKeyModal && apiKey && (
        <ApiKeyModal
          currentKeyHint={apiKey}
          onKeyChanged={handleApiKeyChanged}
          onKeyClear={handleClearApiKey}
          onClose={() => setShowApiKeyModal(false)}
        />
      )}
    </div>
  );
}
