// ABOUTME: Processed PDF preview panel with success indicator and optional mapping legend.
// ABOUTME: Renders the redacted/pseudonymised PDF from base64 response data.

import { CheckCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { base64ToBlobUrl, type HighlightColor, type RedactionResponse } from "../api/redaction";

const HIGHLIGHT_COLORS: { value: HighlightColor; bg: string; ring: string }[] = [
  { value: "white", bg: "bg-white", ring: "ring-white" },
  { value: "blue", bg: "bg-blue-400", ring: "ring-blue-400" },
  { value: "green", bg: "bg-green-400", ring: "ring-green-400" },
  { value: "yellow", bg: "bg-yellow-300", ring: "ring-yellow-300" },
  { value: "pink", bg: "bg-pink-400", ring: "ring-pink-400" },
  { value: "purple", bg: "bg-purple-400", ring: "ring-purple-400" },
];

interface ResultPanelProps {
  result: RedactionResponse;
  onHighlightColorChange: (color: HighlightColor) => Promise<void>;
}

export function ResultPanel({ result, onHighlightColorChange }: ResultPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [recoloring, setRecoloring] = useState(false);

  const isPseudo = result.mode === "pseudonymise";
  const mappingEntries = result.mapping ? Object.entries(result.mapping) : [];
  const hasMappings = isPseudo && mappingEntries.length > 0;

  const handleColorChange = async (color: HighlightColor) => {
    if (color === result.highlightColor || recoloring) return;
    setRecoloring(true);
    try {
      await onHighlightColorChange(color);
    } finally {
      setRecoloring(false);
    }
  };

  useEffect(() => {
    const url = base64ToBlobUrl(result.redacted_pdf);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.redacted_pdf]);

  if (!blobUrl) return null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <iframe src={`${blobUrl}#toolbar=0`} className="flex-1 w-full bg-bg" title="Processed PDF" />
      {hasMappings && showMapping && (
        <div className="border-t border-border bg-raised px-4 py-2 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-dim">
                <th className="text-left font-medium pb-1 pr-4">Pseudonym</th>
                <th className="text-left font-medium pb-1">Original</th>
              </tr>
            </thead>
            <tbody>
              {mappingEntries.map(([pseudonym, original]) => (
                <tr key={pseudonym} className="border-t border-border-subtle">
                  <td className="py-1 pr-4 text-pseudo font-mono">{pseudonym}</td>
                  <td className="py-1 text-text-sub">{original}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-2.5 px-4 h-11 bg-bg border-t border-border">
        <CheckCircle className={`w-4.5 h-4.5 shrink-0 ${isPseudo ? "text-pseudo" : "text-done"}`} />
        <span className={`text-xs font-medium ${isPseudo ? "text-pseudo" : "text-done"}`}>
          {isPseudo ? "Pseudonymised" : "Redacted"}
        </span>
        {isPseudo && (
          <div className="flex items-center gap-1 ml-1">
            {recoloring && <Loader2 className="w-3 h-3 text-text-dim animate-spin" />}
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={recoloring}
                onClick={() => handleColorChange(c.value)}
                aria-label={`Highlight: ${c.value}`}
                className={`
                  w-3.5 h-3.5 rounded-full ${c.bg} transition-all duration-150
                  ${
                    result.highlightColor === c.value
                      ? `ring-1.5 ${c.ring} ring-offset-1 ring-offset-bg scale-110`
                      : "opacity-40 hover:opacity-80 hover:scale-110"
                  }
                  ${recoloring ? "pointer-events-none" : "cursor-pointer"}
                `}
              />
            ))}
          </div>
        )}
        {result.reasoning && (
          <span className="text-xs text-text-faint truncate ml-2">{result.reasoning}</span>
        )}
        {hasMappings && (
          <button
            type="button"
            onClick={() => setShowMapping((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-text-dim hover:text-text-sub transition-colors"
          >
            {mappingEntries.length} {mappingEntries.length === 1 ? "mapping" : "mappings"}
            {showMapping ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
