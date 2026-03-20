// ABOUTME: Engine-internal types and error class for the client-side redaction pipeline.
// ABOUTME: Shared across pdf, providers, pricing, and orchestrator modules.

export type ProcessingMode = "redact" | "pseudonymise";
export type HighlightColor = "white" | "blue" | "green" | "yellow" | "pink" | "purple";
export type ImageFillColor = "white" | "lightgray" | "black";

/** Bounding rectangle [x0, y0, x1, y1] in PDF coordinates. */
export type BoundingRect = [number, number, number, number];

export interface ImageTarget {
  id: string;
  page: number;
  rect: BoundingRect;
}

export interface ImageRedactionSettings {
  fillColor: ImageFillColor;
  label: string;
  showLabel: boolean;
  excludedImageIds: string[];
}

export const DEFAULT_IMAGE_SETTINGS: ImageRedactionSettings = {
  fillColor: "white",
  label: "REDACTED",
  showLabel: true,
  excludedImageIds: [],
};

export interface RedactionTarget {
  text: string;
  page: number;
  context: string | null;
  pseudonym?: string;
}

export interface RedactionResult {
  targets: RedactionTarget[];
  mapping?: Record<string, string>;
  reasoning: string | null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  model: string;
  durationMs: number;
}

export interface ModelPricing {
  input: number;
  output: number;
  thinking: number;
}

export interface CostEstimate {
  costUsd: number;
  pricingSource: string;
}

export interface RedactionPipelineResult {
  redactedPdf: Uint8Array;
  redactionCount: number;
  targets: RedactionTarget[];
  reasoning: string | null;
  permanent: boolean;
  mode: ProcessingMode;
  mapping: Record<string, string> | null;
  imageTargets: ImageTarget[];
  imageSettings: ImageRedactionSettings;
  tokenUsage: TokenUsage;
  costEstimate: CostEstimate;
  totalDurationMs: number;
}

export type RedactionErrorCode =
  | "WASM_LOAD"
  | "API_KEY_INVALID"
  | "RATE_LIMIT"
  | "NETWORK"
  | "PARSE"
  | "PDF_TOO_LARGE";

export class RedactionEngineError extends Error {
  readonly code: RedactionErrorCode;

  constructor(code: RedactionErrorCode, message: string) {
    super(message);
    this.name = "RedactionEngineError";
    this.code = code;
  }
}
