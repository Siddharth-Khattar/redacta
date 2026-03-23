// ABOUTME: Bottom bar with redaction stats, usage metrics, and download/retry actions.
// ABOUTME: Shows redaction count, token usage, cost estimate, and processing time.

import { ArrowDownToLine, FileText, RotateCcw } from "lucide-react";
import { downloadFromBase64, type RedactionResponse, type RedactionTarget } from "../api/redaction";

interface DownloadBarProps {
  result: RedactionResponse;
  originalFileName: string;
  prompt: string;
  onRedactAgain: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function Dot() {
  return <span className="text-text-faint">&middot;</span>;
}

function downloadJson(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DownloadBar({ result, originalFileName, prompt, onRedactAgain }: DownloadBarProps) {
  const isPseudo = result.mode === "pseudonymise";

  const handleDownload = () => {
    const suffix = isPseudo ? "_pseudonymised.pdf" : "_redacted.pdf";
    const outputName = originalFileName.replace(/\.pdf$/i, suffix);
    downloadFromBase64(result.redacted_pdf, outputName);
  };

  const handleExportLog = () => {
    const { usage } = result;

    const appliedCount =
      "applied_count" in result ? (result as Record<string, unknown>).applied_count : undefined;
    const missedTargets =
      "missed_targets" in result ? (result as Record<string, unknown>).missed_targets : undefined;

    const applied = typeof appliedCount === "number" ? appliedCount : result.redaction_count;
    const missed = Array.isArray(missedTargets) ? missedTargets.length : 0;

    const log: Record<string, unknown> = {
      source_file: originalFileName,
      timestamp: new Date().toISOString(),
      mode: result.mode,
      model: usage.model,
      prompt,
      targets: result.targets.map((t: RedactionTarget) => ({
        text: t.text,
        page: t.page,
        context: t.context,
        ...(t.pseudonym ? { pseudonym: t.pseudonym } : {}),
      })),
      ...(Array.isArray(missedTargets) && missedTargets.length > 0
        ? { missed_targets: missedTargets }
        : {}),
      ...(isPseudo && result.mapping ? { mapping: result.mapping } : {}),
      stats: {
        identified: result.targets.length,
        applied,
        missed,
      },
      usage: {
        tokens: usage.total_tokens,
        cost_usd: usage.estimated_cost_usd,
        duration_ms: usage.total_duration_ms,
      },
    };

    const logFileName = originalFileName.replace(/\.pdf$/i, "_audit_log.json");
    downloadJson(log, logFileName);
  };

  const uniquePages = new Set(result.targets.map((t: RedactionTarget) => t.page)).size;
  const { usage } = result;
  const cost = usage.estimated_cost_usd;
  const statLabel = isPseudo
    ? result.redaction_count === 1
      ? "replacement"
      : "replacements"
    : result.redaction_count === 1
      ? "redaction"
      : "redactions";

  return (
    <div className="flex-none border-t border-border px-6 py-3.5 bg-raised">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        {/* Left: Pages */}
        <div className="text-sm text-text-sub flex items-center gap-3">
          <span>
            <span className="font-semibold text-text">{result.redaction_count}</span> {statLabel}
          </span>
          {uniquePages > 0 && (
            <>
              <Dot />
              <span>
                <span className="font-semibold text-text">{uniquePages}</span>{" "}
                {uniquePages === 1 ? "page" : "pages"}
              </span>
            </>
          )}
        </div>

        {/* Center: Token stats */}
        <div className="text-sm text-text-sub flex items-center justify-center gap-3">
          <span className="font-mono text-sm text-text-dim" title="Total processing time">
            {formatDuration(usage.total_duration_ms)}
          </span>
          {usage.total_tokens > 0 && (
            <>
              <Dot />
              <span
                className="font-mono text-sm text-text-dim"
                title={[
                  `Input: ${usage.input_tokens.toLocaleString()}`,
                  `Output: ${usage.output_tokens.toLocaleString()}`,
                  usage.thinking_tokens > 0
                    ? `Thinking: ${usage.thinking_tokens.toLocaleString()}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n")}
              >
                {formatTokenCount(usage.total_tokens)} tokens
              </span>
              {cost > 0 && (
                <>
                  <Dot />
                  <span
                    className="font-mono text-sm text-text-dim"
                    title={`Estimated cost for ${usage.model} (${usage.pricing_source})`}
                  >
                    ~{formatCost(cost)}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRedactAgain}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-text-sub hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Again
          </button>
          <button
            type="button"
            onClick={handleExportLog}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-text-sub hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export Log
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors shadow-sm ${
              isPseudo ? "bg-pseudo hover:bg-pseudo-hover" : "bg-redact hover:bg-redact-hover"
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
