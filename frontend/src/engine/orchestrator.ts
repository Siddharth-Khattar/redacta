// ABOUTME: Pipeline coordinator for the client-side PDF redaction workflow.
// ABOUTME: Orchestrates: extract text → identify targets → apply redactions/pseudonymisation → estimate cost.

import { applyPseudonymisation, applyRedactions, detectImages, extractText } from "./pdf";
import { estimateCost, fetchPricing } from "./pricing";
import { getProvider } from "./providers/registry";
import type { ProviderId } from "./providers/types";
import {
  DEFAULT_IMAGE_SETTINGS,
  type HighlightColor,
  type ImageRedactionSettings,
  type ImageTarget,
  type ProcessingMode,
  type RedactionPipelineResult,
  type RedactionResult,
  type TokenUsage,
} from "./types";

/**
 * Run the full redaction pipeline: extract → identify → redact/pseudonymise → cost.
 *
 * @param apiKey         - User's API key for the selected provider
 * @param file           - The PDF File object
 * @param prompt         - Natural-language redaction instructions (empty for image-only mode)
 * @param permanent      - If true, permanently remove text beneath redactions
 * @param providerId     - LLM provider identifier
 * @param modelId        - Model identifier within the provider
 * @param thinkingLevel  - Thinking depth: minimal, low, medium, high
 * @param mode           - Processing mode: redact or pseudonymise
 * @param highlightColor - Background color for pseudonymisation labels
 * @param redactImages   - If true, detect and redact all images on every page
 * @param thorough       - If true, use thorough (not conservative) system prompt
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
  redactImages = false,
  thorough = false,
): Promise<RedactionPipelineResult> {
  const startTime = performance.now();
  const pdfBytes = await file.arrayBuffer();
  const hasPrompt = prompt.length > 0;

  let redactionResult: RedactionResult;
  let usage: TokenUsage;

  if (hasPrompt) {
    const provider = getProvider(providerId);
    const pdfText = await extractText(pdfBytes);
    const llmResult = await provider.identifyTargets(
      apiKey,
      modelId,
      pdfText,
      prompt,
      thinkingLevel,
      mode,
      thorough,
    );
    redactionResult = llmResult.result;
    usage = llmResult.usage;
  } else {
    // Image-only mode: skip LLM entirely
    redactionResult = { targets: [], reasoning: null };
    usage = {
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      model: modelId,
      durationMs: 0,
    };
  }

  // Detect images if requested
  const imageTargets: ImageTarget[] = redactImages ? await detectImages(pdfBytes) : [];
  const imageSettings: ImageRedactionSettings | null =
    imageTargets.length > 0 ? { ...DEFAULT_IMAGE_SETTINGS } : null;

  // Apply redactions or pseudonymisation
  const redactedPdf =
    mode === "pseudonymise"
      ? await applyPseudonymisation(
          pdfBytes,
          redactionResult.targets,
          highlightColor,
          imageTargets,
          imageSettings,
        )
      : await applyRedactions(
          pdfBytes,
          redactionResult.targets,
          permanent,
          imageTargets,
          imageSettings,
        );

  const pricingResult = await fetchPricing();
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
    imageTargets,
    imageSettings: imageSettings ?? DEFAULT_IMAGE_SETTINGS,
    tokenUsage: usage,
    costEstimate,
    totalDurationMs,
  };
}
