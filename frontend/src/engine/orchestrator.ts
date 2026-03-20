// ABOUTME: Pipeline coordinator for the client-side PDF redaction workflow.
// ABOUTME: Orchestrates: extract text → identify targets → apply redactions/pseudonymisation → estimate cost.

import { applyPseudonymisation, applyRedactions, extractText } from "./pdf";
import { estimateCost, fetchPricing } from "./pricing";
import { getProvider } from "./providers/registry";
import type { ProviderId } from "./providers/types";
import type { HighlightColor, ProcessingMode, RedactionPipelineResult } from "./types";

/**
 * Run the full redaction pipeline: extract → identify → redact/pseudonymise → cost.
 *
 * @param apiKey         - User's API key for the selected provider
 * @param file           - The PDF File object
 * @param prompt         - Natural-language redaction instructions
 * @param permanent      - If true, permanently remove text beneath redactions
 * @param providerId     - LLM provider identifier
 * @param modelId        - Model identifier within the provider
 * @param thinkingLevel  - Thinking depth: minimal, low, medium, high
 * @param mode           - Processing mode: redact or pseudonymise
 * @param highlightColor - Background color for pseudonymisation labels
 */
export async function runRedactionPipeline(
  apiKey: string,
  file: File,
  prompt: string,
  permanent: boolean,
  providerId: ProviderId,
  modelId: string,
  thinkingLevel: string,
  mode: ProcessingMode = "redact",
  highlightColor: HighlightColor = "white",
): Promise<RedactionPipelineResult> {
  const startTime = performance.now();

  const provider = getProvider(providerId);

  // 1. Read file into ArrayBuffer
  const pdfBytes = await file.arrayBuffer();

  // 2. Extract text from all pages (lazy-loads WASM here)
  const pdfText = await extractText(pdfBytes);

  // 3. Fetch pricing and identify targets in parallel
  const [pricingResult, llmResult] = await Promise.all([
    fetchPricing(),
    provider.identifyTargets(apiKey, modelId, pdfText, prompt, thinkingLevel, mode),
  ]);

  const { result: redactionResult, usage } = llmResult;

  // 4. Apply redactions or pseudonymisation based on mode
  const redactedPdf =
    mode === "pseudonymise"
      ? await applyPseudonymisation(pdfBytes, redactionResult.targets, highlightColor)
      : await applyRedactions(pdfBytes, redactionResult.targets, permanent);

  // 5. Estimate cost
  const costEstimate = estimateCost(
    modelId,
    usage.inputTokens,
    usage.outputTokens,
    usage.thinkingTokens,
    pricingResult.pricing,
    pricingResult.source,
  );

  const totalDurationMs = Math.round(performance.now() - startTime);

  return {
    redactedPdf,
    redactionCount: redactionResult.targets.length,
    targets: redactionResult.targets,
    reasoning: redactionResult.reasoning,
    permanent,
    mode,
    mapping: redactionResult.mapping ?? null,
    tokenUsage: usage,
    costEstimate,
    totalDurationMs,
  };
}
