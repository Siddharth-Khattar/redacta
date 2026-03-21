// ABOUTME: Workspace page with PDF viewer, prompt panel, and processing flow.
// ABOUTME: Loads the active PDF from IndexedDB on mount and manages the workspace state machine.

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  type HighlightColor,
  type ImageRedactionSettings,
  type ProcessingMode,
  RATE_LIMIT_ERROR_MESSAGE,
  type RedactionResponse,
  reapplySettings,
  redactPdf,
} from "../api/redaction";
import { DownloadBar } from "../components/DownloadBar";
import { PdfPanel } from "../components/PdfPanel";
import { ProcessingPanel } from "../components/ProcessingPanel";
import { PromptPanel } from "../components/PromptPanel";
import { RedactionWorkspace } from "../components/RedactionWorkspace";
import { ResultPanel } from "../components/ResultPanel";
import { ScanOverlay } from "../components/ScanOverlay";
import type { ProviderId } from "../engine/providers/types";
import { RedactionEngineError } from "../engine/types";
import type { ProviderKeys } from "../hooks/useProviderKeys";
import { loadPdf, storePdf } from "../lib/pdf-store";

type WorkspaceState = "workspace" | "processing" | "result" | "error";

interface WorkspacePageProps {
  keys: ProviderKeys;
  hasAnyKey: boolean;
  configuredProviders: ProviderId[];
  clearKey: (provider: ProviderId) => void;
  onRequestApiKeyModal: () => void;
}

export function WorkspacePage({
  keys,
  hasAnyKey,
  configuredProviders,
  clearKey,
  onRequestApiKeyModal,
}: WorkspacePageProps) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<WorkspaceState>("workspace");
  const [lastMode, setLastMode] = useState<ProcessingMode>("redact");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RedactionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pdfPanelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load PDF from IndexedDB on mount; redirect home if nothing stored
  useEffect(() => {
    loadPdf()
      .then((pdf) => {
        if (pdf) setFile(pdf);
        else navigate("/", { replace: true });
      })
      .catch(() => {
        navigate("/", { replace: true });
      });
  }, [navigate]);

  // Abort in-flight requests on unmount (e.g. navigating away)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Show API key modal when no keys are configured
  useEffect(() => {
    if (file && !hasAnyKey) {
      abortControllerRef.current?.abort();
      if (state === "processing") setState("workspace");
      onRequestApiKeyModal();
    }
  }, [file, hasAnyKey, state, onRequestApiKeyModal]);

  const handleFileChange = useCallback(async (accepted: File) => {
    await storePdf(accepted);
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

        if (controller.signal.aborted) return;

        setResult(response);
        setState("result");
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof DOMException && error.name === "AbortError") return;

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

  // Still loading from IndexedDB
  if (!file) return null;

  return (
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
              onFileChange={handleFileChange}
            />
            {state === "processing" && <ScanOverlay containerRef={pdfPanelRef} />}
          </div>
        }
        right={
          <>
            {state === "workspace" && configuredProviders.length > 0 && (
              <PromptPanel configuredProviders={configuredProviders} onSubmit={handleSubmit} />
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
                    {lastMode === "pseudonymise" ? "Pseudonymisation failed" : "Redaction failed"}
                  </h3>
                  <p className="text-sm text-text-sub mb-2 leading-relaxed">{errorMessage}</p>
                  {errorMessage === RATE_LIMIT_ERROR_MESSAGE && (
                    <p className="text-xs text-text-dim mb-6">Usually resolves within a minute.</p>
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
  );
}
