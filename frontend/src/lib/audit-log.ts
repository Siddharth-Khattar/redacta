// ABOUTME: Core audit log module for PDF redaction operations.
// ABOUTME: Builds structured audit records and exports them as JSON or CSV.

import type { HighlightColor, ProcessingMode, RedactionResponse } from "../api/redaction";
import { getPresetById } from "../engine/presets";
import { getModelDefinition } from "../engine/providers/registry";
import type { ProviderId } from "../engine/providers/types";

// ---------------------------------------------------------------------------
// Processing context (captured at submit time by WorkspacePage)
// ---------------------------------------------------------------------------

export interface ProcessingContext {
  prompt: string;
  mode: ProcessingMode;
  permanent: boolean;
  providerId: ProviderId;
  modelId: string;
  thinkingLevel: string;
  highlightColor: HighlightColor;
  redactImages: boolean;
  thorough: boolean;
  presetId: string | null;
  startedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Audit log schema
// ---------------------------------------------------------------------------

export interface AuditLogTarget {
  index: number;
  text: string;
  page: number;
  context: string | null;
  category: string | null;
  pseudonym: string | null;
}

export interface AuditLog {
  version: "1.0";
  exportedAt: string;
  source: {
    filename: string;
    sizeBytes: number;
    pageCount: number;
  };
  processing: {
    startedAt: string;
    mode: ProcessingMode;
    permanent: boolean;
    provider: string;
    model: string;
    thinkingLevel: string;
    thoroughness: "conservative" | "thorough";
    prompt: string;
    preset: string | null;
    redactImages: boolean;
  };
  results: {
    reasoning: string | null;
    targets: AuditLogTarget[];
    imageRedactions: {
      enabled: boolean;
      identified: number;
      excluded: number;
    };
    stats: {
      totalTargets: number;
      pagesAffected: number;
    };
  };
  mapping: Record<string, string> | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalTokens: number;
    llmDurationMs: number;
    totalDurationMs: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PSEUDONYM_CATEGORY_RE = /^\[([A-Z]+)_\d+\]$/;

/** Extract a category label from a pseudonym token, e.g. `[PERSON_1]` -> `"PERSON"`. */
function deriveCategoryFromPseudonym(pseudonym: string): string | null {
  const match = PSEUDONYM_CATEGORY_RE.exec(pseudonym);
  return match?.[1] ?? null;
}

/** Format byte count as a human-readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a millisecond duration as a compact string, e.g. `3.4s`. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Escape a value for safe inclusion in a CSV field. */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Build a complete audit log record from processing context and results. */
export function buildAuditLog(
  context: ProcessingContext,
  result: RedactionResponse,
  file: File,
): AuditLog {
  const preset = context.presetId ? getPresetById(context.presetId) : undefined;
  const modelDef = getModelDefinition(context.modelId);
  const modelLabel = modelDef?.label ?? context.modelId;

  const targets: AuditLogTarget[] = result.targets.map((target, i) => {
    const pseudonym = target.pseudonym ?? null;
    const category =
      context.mode === "pseudonymise" && pseudonym
        ? deriveCategoryFromPseudonym(pseudonym)
        : (target.category ?? null);

    return {
      index: i + 1,
      text: target.text,
      page: target.page,
      context: target.context,
      category,
      pseudonym,
    };
  });

  const uniquePages = new Set(targets.map((t) => t.page));

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    source: {
      filename: file.name,
      sizeBytes: file.size,
      pageCount: result.page_count,
    },
    processing: {
      startedAt: context.startedAt,
      mode: context.mode,
      permanent: context.permanent,
      provider: context.providerId,
      model: modelLabel,
      thinkingLevel: context.thinkingLevel,
      thoroughness: context.thorough ? "thorough" : "conservative",
      prompt: context.prompt,
      preset: preset?.label ?? null,
      redactImages: context.redactImages,
    },
    results: {
      reasoning: result.reasoning,
      targets,
      imageRedactions: {
        enabled: result.redactImages,
        identified: result.imageTargets.length,
        excluded: result.imageSettings.excludedImageIds.length,
      },
      stats: {
        totalTargets: targets.length,
        pagesAffected: uniquePages.size,
      },
    },
    mapping: result.mapping,
    usage: {
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      thinkingTokens: result.usage.thinking_tokens,
      totalTokens: result.usage.total_tokens,
      llmDurationMs: result.usage.llm_duration_ms,
      totalDurationMs: result.usage.total_duration_ms,
    },
  };
}

// ---------------------------------------------------------------------------
// Exporters
// ---------------------------------------------------------------------------

/** Export an audit log as a pretty-printed JSON blob. */
export function exportAsJson(log: AuditLog): Blob {
  return new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
}

/** Export an audit log as a CSV blob with metadata header and target rows. */
export function exportAsCsv(log: AuditLog): Blob {
  const lines: string[] = [];

  // Metadata header
  const permanentLabel = log.processing.permanent ? "permanent" : "highlight";
  const promptPreview =
    log.processing.prompt.length > 60
      ? `${log.processing.prompt.slice(0, 60)}...`
      : log.processing.prompt;
  const reasoningPreview = log.results.reasoning
    ? log.results.reasoning.length > 60
      ? `${log.results.reasoning.slice(0, 60)}...`
      : log.results.reasoning
    : "none";
  const totalTokensFormatted = log.usage.totalTokens.toLocaleString("en-US");

  lines.push("# Redacta Audit Log v1.0");
  lines.push(
    `# Source: ${log.source.filename} (${formatFileSize(log.source.sizeBytes)}, ${log.source.pageCount} pages)`,
  );
  lines.push(`# Processed: ${log.processing.startedAt}`);
  lines.push(`# Mode: ${log.processing.mode} (${permanentLabel})`);
  lines.push(`# Model: ${log.processing.model} (${log.processing.provider})`);
  lines.push(
    `# Thinking: ${log.processing.thinkingLevel} | Thoroughness: ${log.processing.thoroughness}`,
  );
  lines.push(`# Prompt: "${promptPreview}"`);
  lines.push(`# Preset: ${log.processing.preset ?? "none"}`);
  lines.push(`# Reasoning: "${reasoningPreview}"`);
  lines.push(
    `# Stats: ${log.results.stats.totalTargets} targets across ${log.results.stats.pagesAffected} pages`,
  );
  lines.push(
    `# Duration: ${formatDuration(log.usage.totalDurationMs)} | Tokens: ${totalTokensFormatted}`,
  );
  lines.push("#");

  // CSV header row
  lines.push("index,text,page,context,category,pseudonym");

  // Target rows
  for (const target of log.results.targets) {
    const row = [
      String(target.index),
      csvEscape(target.text),
      String(target.page),
      csvEscape(target.context ?? ""),
      csvEscape(target.category ?? ""),
      csvEscape(target.pseudonym ?? ""),
    ];
    lines.push(row.join(","));
  }

  // Mapping section (pseudonymisation mode)
  if (log.mapping) {
    lines.push("");
    lines.push("# Mapping Table");
    lines.push("pseudonym,original");
    for (const [pseudonym, original] of Object.entries(log.mapping)) {
      lines.push(`${csvEscape(pseudonym)},${csvEscape(original)}`);
    }
  }

  return new Blob([lines.join("\n")], { type: "text/csv" });
}
