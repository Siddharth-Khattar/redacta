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
  type RedactionStats,
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
): Promise<RedactionPipelineResult> {
  const startTime = performance.now();
  const pdfBytes = await file.arrayBuffer();
  const hasPrompt = prompt.length > 0;

  let redactionResult: RedactionResult;
  let usage: TokenUsage;

  if (hasPrompt) {
    const provider = getProvider(providerId);
    const pdfText = await extractText(pdfBytes);

    // Chunk large documents to avoid token limits. Each chunk is processed
    // independently and results are merged.
    const PAGES_PER_CHUNK = 25;
    const pageNumbers = Array.from(pdfText.keys()).sort((a, b) => a - b);

    if (pageNumbers.length <= PAGES_PER_CHUNK) {
      const llmResult = await provider.identifyTargets(
        apiKey,
        modelId,
        pdfText,
        prompt,
        thinkingLevel,
        mode,
      );
      redactionResult = llmResult.result;
      usage = llmResult.usage;
    } else {
      // Split pages into chunks and process each
      const allTargets: RedactionResult["targets"] = [];
      const allMappings: Record<string, string> = {};
      const reasonings: string[] = [];
      let totalInput = 0;
      let totalOutput = 0;
      let totalThinking = 0;
      let totalTokens = 0;
      let totalDuration = 0;

      for (let i = 0; i < pageNumbers.length; i += PAGES_PER_CHUNK) {
        const chunkPages = pageNumbers.slice(i, i + PAGES_PER_CHUNK);
        const chunkText = new Map<number, string>();
        for (const p of chunkPages) {
          chunkText.set(p, pdfText.get(p)!);
        }

        // For pseudonymisation, pass accumulated mappings from prior chunks
        // so the AI reuses the same labels for recurring entities.
        const priorMappings =
          mode === "pseudonymise" && Object.keys(allMappings).length > 0
            ? allMappings
            : undefined;

        const chunkResult = await provider.identifyTargets(
          apiKey,
          modelId,
          chunkText,
          prompt,
          thinkingLevel,
          mode,
          priorMappings,
        );

        allTargets.push(...chunkResult.result.targets);
        if (chunkResult.result.mapping) {
          Object.assign(allMappings, chunkResult.result.mapping);
        }
        if (chunkResult.result.reasoning) {
          reasonings.push(chunkResult.result.reasoning);
        }

        totalInput += chunkResult.usage.inputTokens;
        totalOutput += chunkResult.usage.outputTokens;
        totalThinking += chunkResult.usage.thinkingTokens;
        totalTokens += chunkResult.usage.totalTokens;
        totalDuration += chunkResult.usage.durationMs;
      }

      redactionResult = {
        targets: allTargets,
        mapping: Object.keys(allMappings).length > 0 ? allMappings : undefined,
        reasoning: reasonings.join(" | "),
      };
      usage = {
        inputTokens: totalInput,
        outputTokens: totalOutput,
        thinkingTokens: totalThinking,
        totalTokens,
        model: modelId,
        durationMs: totalDuration,
      };
    }
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
  const pdfResult =
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

  const redactedPdf = pdfResult.pdf;
  const stats: RedactionStats = pdfResult.stats;

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
    stats,
  };
}
