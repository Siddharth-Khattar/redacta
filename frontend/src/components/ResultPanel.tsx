// ABOUTME: Redacted PDF preview panel with success indicator.
// ABOUTME: Renders the redacted PDF from base64 response data.

import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { base64ToBlobUrl, type RedactionResponse } from "../api/redaction";

interface ResultPanelProps {
  result: RedactionResponse;
}

export function ResultPanel({ result }: ResultPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = base64ToBlobUrl(result.redacted_pdf);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.redacted_pdf]);

  if (!blobUrl) return null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-2 bg-bg border-b border-border">
        <CheckCircle className="w-3.5 h-3.5 text-done" />
        <span className="text-xs font-medium text-done">Redacted</span>
        {result.reasoning && (
          <span className="text-xs text-text-faint truncate ml-2">{result.reasoning}</span>
        )}
      </div>
      <iframe src={blobUrl} className="flex-1 w-full bg-bg" title="Redacted PDF" />
    </div>
  );
}
