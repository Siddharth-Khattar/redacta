// ABOUTME: Bottom bar with redaction stats and download/retry actions.
// ABOUTME: Clean stat display with warm accent download button.

import { ArrowDownToLine, RotateCcw } from "lucide-react";
import { downloadFromBase64, type RedactionResponse, type RedactionTarget } from "../api/redaction";

interface DownloadBarProps {
  result: RedactionResponse;
  originalFileName: string;
  onRedactAgain: () => void;
}

export function DownloadBar({ result, originalFileName, onRedactAgain }: DownloadBarProps) {
  const handleDownload = () => {
    const outputName = originalFileName.replace(/\.pdf$/i, "_redacted.pdf");
    downloadFromBase64(result.redacted_pdf, outputName);
  };

  const uniquePages = new Set(result.targets.map((t: RedactionTarget) => t.page)).size;

  return (
    <div className="flex-none border-t border-border px-6 py-3 bg-raised">
      <div className="flex items-center justify-between">
        {/* Stats */}
        <div className="text-sm text-text-sub flex items-center gap-3">
          <span>
            <span className="font-semibold text-text">{result.redaction_count}</span>{" "}
            {result.redaction_count === 1 ? "redaction" : "redactions"}
          </span>
          {uniquePages > 0 && (
            <>
              <span className="text-text-faint">&middot;</span>
              <span>
                <span className="font-semibold text-text">{uniquePages}</span>{" "}
                {uniquePages === 1 ? "page" : "pages"}
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRedactAgain}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-text-sub hover:text-text rounded-lg hover:bg-surface transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Again
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-redact hover:bg-redact-hover text-white text-sm font-medium transition-colors shadow-sm"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
