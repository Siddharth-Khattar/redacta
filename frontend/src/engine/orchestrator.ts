// ABOUTME: Pipeline coordinator for the client-side PDF redaction workflow.
// ABOUTME: Orchestrates: extract text → identify redactions → apply redactions → estimate cost.

import { identifyRedactions } from "./gemini";
import { applyRedactions, extractText } from "./pdf";
import { estimateCost, fetchPricing } from "./pricing";
import type { RedactionPipelineResult } from "./types";

/**
 * Run the full redaction pipeline: extract → identify → redact → cost.
 *
 * @param apiKey     - User's Gemini API key
 * @param file       - The PDF File object
 * @param prompt     - Natural-language redaction instructions
 * @param permanent  - If true, permanently remove text beneath redactions
 * @param model      - Gemini model identifier
 * @param thinkingLevel - Thinking depth: minimal, low, medium, high
 */
export async function runRedactionPipeline(
  apiKey: string,
  file: File,
  prompt: string,
  permanent: boolean,
  model: string,
  thinkingLevel: string,
): Promise<RedactionPipelineResult> {
  const startTime = performance.now();

  // 1. Read file into ArrayBuffer
  const pdfBytes = await file.arrayBuffer();

  // 2. Extract text from all pages (lazy-loads WASM here)
  const pdfText = await extractText(pdfBytes);

  // 3. Fetch pricing and identify redactions in parallel
  const [pricingResult, geminiResult] = await Promise.all([
    fetchPricing(),
    identifyRedactions(apiKey, model, pdfText, prompt, thinkingLevel),
  ]);

  const { result: redactionResult, usage } = geminiResult;

  // 4. Apply redactions to the PDF
  const redactedPdf = await applyRedactions(pdfBytes, redactionResult.targets, permanent);

  // 5. Estimate cost
  const costEstimate = estimateCost(
    model,
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
    tokenUsage: usage,
    costEstimate,
    totalDurationMs,
  };
}
