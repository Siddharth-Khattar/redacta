// ABOUTME: API client adapter for PDF redaction operations.
// ABOUTME: Bridges the client-side engine with the existing UI contract (snake_case response shape).

import { runRedactionPipeline } from "../engine/orchestrator";
import { applyPseudonymisation, applyRedactions } from "../engine/pdf";
import type { ProviderId } from "../engine/providers/types";
import {
  type HighlightColor,
  type ImageFillColor,
  type ImageRedactionSettings,
  type ImageTarget,
  type ProcessingMode,
  RedactionEngineError,
} from "../engine/types";

export type { HighlightColor, ImageFillColor, ImageRedactionSettings, ImageTarget, ProcessingMode };

export const RATE_LIMIT_ERROR_MESSAGE =
  "Our AI service is currently experiencing high demand. Please wait a moment and try again.";

export interface RedactionTarget {
  text: string;
  page: number;
  context: string | null;
  pseudonym?: string;
  category?: string;
}

export interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  total_tokens: number;
  model: string;
  llm_duration_ms: number;
  total_duration_ms: number;
  estimated_cost_usd: number;
  pricing_source: string;
}

export interface RedactionResponse {
  redacted_pdf: Blob;
  redaction_count: number;
  targets: RedactionTarget[];
  reasoning: string | null;
  permanent: boolean;
  mode: ProcessingMode;
  highlightColor: HighlightColor;
  redactImages: boolean;
  page_count: number;
  imageTargets: ImageTarget[];
  imageSettings: ImageRedactionSettings;
  mapping: Record<string, string> | null;
  usage: UsageStats;
}

/** Convert a Uint8Array to an immutable PDF Blob (zero-copy). */
function uint8ArrayToBlob(bytes: Uint8Array): Blob {
  // WASM memory always uses standard ArrayBuffer; narrow the type for BlobPart compatibility
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

/**
 * Redact a PDF file using natural language instructions.
 * Runs entirely client-side via the engine modules.
 */
export async function redactPdf(
  apiKey: string,
  file: File,
  prompt: string,
  permanent: boolean,
  providerId: ProviderId,
  modelId: string,
  thinkingLevel: string,
  mode: ProcessingMode = "redact",
  highlightColor: HighlightColor = "white",
  redactImages = false,
  thorough = false,
): Promise<RedactionResponse> {
  try {
    const result = await runRedactionPipeline(
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
      thorough,
    );

    return {
      redacted_pdf: uint8ArrayToBlob(result.redactedPdf),
      redaction_count: result.redactionCount,
      targets: result.targets.map((t) => ({
        text: t.text,
        page: t.page,
        context: t.context,
        pseudonym: t.pseudonym,
        category: t.category,
      })),
      reasoning: result.reasoning,
      permanent: result.permanent,
      mode: result.mode,
      highlightColor,
      redactImages,
      page_count: result.pageCount,
      imageTargets: result.imageTargets,
      imageSettings: result.imageSettings,
      mapping: result.mapping,
      usage: {
        input_tokens: result.tokenUsage.inputTokens,
        output_tokens: result.tokenUsage.outputTokens,
        thinking_tokens: result.tokenUsage.thinkingTokens,
        total_tokens: result.tokenUsage.totalTokens,
        model: result.tokenUsage.model,
        llm_duration_ms: result.tokenUsage.durationMs,
        total_duration_ms: result.totalDurationMs,
        estimated_cost_usd: result.costEstimate.costUsd,
        pricing_source: result.costEstimate.pricingSource,
      },
    };
  } catch (error) {
    if (error instanceof RedactionEngineError) {
      if (error.code === "RATE_LIMIT") {
        throw new Error(RATE_LIMIT_ERROR_MESSAGE);
      }
      throw error;
    }
    throw error;
  }
}

/**
 * Trigger a browser download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Re-apply PDF rendering with updated visual settings.
 * Reuses cached targets so no LLM call is needed.
 * Works for both redact and pseudonymise modes.
 */
export async function reapplySettings(
  file: File,
  targets: RedactionTarget[],
  mode: ProcessingMode,
  permanent: boolean,
  highlightColor: HighlightColor,
  imageTargets: ImageTarget[],
  imageSettings: ImageRedactionSettings | null,
): Promise<Blob> {
  const pdfBytes = await file.arrayBuffer();

  const redactedPdf =
    mode === "pseudonymise"
      ? await applyPseudonymisation(pdfBytes, targets, highlightColor, imageTargets, imageSettings)
      : await applyRedactions(pdfBytes, targets, permanent, imageTargets, imageSettings);

  return uint8ArrayToBlob(redactedPdf);
}
