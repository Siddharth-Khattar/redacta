// ABOUTME: Engine-internal types and error class for the client-side redaction pipeline.
// ABOUTME: Shared across pdf, providers, pricing, and orchestrator modules.

export interface RedactionTarget {
  text: string;
  page: number;
  context: string | null;
}

export interface RedactionResult {
  targets: RedactionTarget[];
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
