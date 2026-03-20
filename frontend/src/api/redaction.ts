// ABOUTME: API client adapter for PDF redaction operations.
// ABOUTME: Bridges the client-side engine with the existing UI contract (snake_case response shape).

import { runRedactionPipeline } from "../engine/orchestrator";
import { applyPseudonymisation } from "../engine/pdf";
import type { ProviderId } from "../engine/providers/types";
import { type HighlightColor, type ProcessingMode, RedactionEngineError } from "../engine/types";

export type { HighlightColor, ProcessingMode };

export const RATE_LIMIT_ERROR_MESSAGE =
  "Our AI service is currently experiencing high demand. Please wait a moment and try again.";

export interface RedactionTarget {
  text: string;
  page: number;
  context: string | null;
  pseudonym?: string;
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
  redacted_pdf: string;
  redaction_count: number;
  targets: RedactionTarget[];
  reasoning: string | null;
  permanent: boolean;
  mode: ProcessingMode;
  highlightColor: HighlightColor;
  mapping: Record<string, string> | null;
  usage: UsageStats;
}

/** Convert a Uint8Array to a base64 string. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Process in chunks to avoid call stack overflow on large PDFs
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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
    );

    return {
      redacted_pdf: uint8ArrayToBase64(result.redactedPdf),
      redaction_count: result.redactionCount,
      targets: result.targets.map((t) => ({
        text: t.text,
        page: t.page,
        context: t.context,
        pseudonym: t.pseudonym,
      })),
      reasoning: result.reasoning,
      permanent: result.permanent,
      mode: result.mode,
      highlightColor,
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
 * Convert a base64 string to a blob URL for PDF display.
 * Caller is responsible for revoking the URL via URL.revokeObjectURL.
 */
export function base64ToBlobUrl(base64: string): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * Trigger a browser download from a blob URL or base64 data.
 */
export function downloadFromBase64(base64: string, filename: string): void {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
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
 * Re-apply pseudonymisation with a different highlight color.
 * Reuses cached targets so no LLM call is needed.
 */
export async function reapplyHighlightColor(
  file: File,
  targets: RedactionTarget[],
  highlightColor: HighlightColor,
): Promise<string> {
  const pdfBytes = await file.arrayBuffer();
  const redactedPdf = await applyPseudonymisation(pdfBytes, targets, highlightColor);
  return uint8ArrayToBase64(redactedPdf);
}
