// ABOUTME: Bottom bar with redaction stats, usage metrics, and download/retry actions.
// ABOUTME: Shows redaction count, token usage, cost estimate, and processing time.

import { ArrowDownToLine, ChevronUp, FileText, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadBlob, type RedactionResponse, type RedactionTarget } from "../api/redaction";
import { buildAuditLog, exportAsCsv, exportAsJson, type ProcessingContext } from "../lib/audit-log";

interface DownloadBarProps {
  result: RedactionResponse;
  originalFileName: string;
  onRedactAgain: () => void;
  file: File;
  processingContext: ProcessingContext | null;
}

type ExportFormat = "json" | "csv" | "pdf";

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

const EXPORT_OPTIONS: Array<{ format: ExportFormat; label: string; ext: string }> = [
  { format: "json", label: "JSON", ext: ".json" },
  { format: "csv", label: "CSV", ext: ".csv" },
  { format: "pdf", label: "PDF Report", ext: ".pdf" },
];

export function DownloadBar({
  result,
  originalFileName,
  onRedactAgain,
  file,
  processingContext,
}: DownloadBarProps) {
  const isPseudo = result.mode === "pseudonymise";

  const handleDownload = () => {
    const suffix = isPseudo ? "_pseudonymised.pdf" : "_redacted.pdf";
    const outputName = originalFileName.replace(/\.pdf$/i, suffix);
    downloadBlob(result.redacted_pdf, outputName);
  };

  // Export log dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState<ExportFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!processingContext) return;
      setExportMenuOpen(false);
      setExportLoading(format);

      try {
        const log = buildAuditLog(processingContext, result, file);
        const baseName = originalFileName.replace(/\.pdf$/i, "");
        let blob: Blob;
        let filename: string;

        if (format === "json") {
          blob = exportAsJson(log);
          filename = `${baseName}_audit_log.json`;
        } else if (format === "csv") {
          blob = exportAsCsv(log);
          filename = `${baseName}_audit_log.csv`;
        } else {
          // Lazy-load the PDF exporter (separate chunk, loaded on first use)
          const { exportAsPdf } = await import("../lib/audit-log-pdf");
          blob = await exportAsPdf(log);
          filename = `${baseName}_audit_report.pdf`;
        }

        downloadBlob(blob, filename);
      } catch (error) {
        // Prevent unhandled rejections from propagating to error boundaries
        console.error("Audit log export failed:", error);
      } finally {
        setExportLoading(null);
      }
    },
    [processingContext, result, file, originalFileName],
  );

  const canExport = processingContext !== null;

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
          {/* Export Log dropdown */}
          {canExport && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={exportLoading !== null}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-text-sub hover:text-text rounded-lg hover:bg-surface transition-colors"
              >
                {exportLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Export Log
                <ChevronUp
                  className={`w-3.5 h-3.5 transition-transform ${exportMenuOpen ? "" : "rotate-180"}`}
                />
              </button>
              {exportMenuOpen && (
                <div className="absolute bottom-full mb-1 left-0 w-40 bg-raised border border-border rounded-lg shadow-lg overflow-hidden z-10">
                  {EXPORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.format}
                      type="button"
                      onClick={() => handleExport(opt.format)}
                      className="w-full px-3 py-2 text-sm text-left text-text-sub hover:text-text hover:bg-surface transition-colors"
                    >
                      {opt.label}
                      <span className="text-text-faint ml-1.5">{opt.ext}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
