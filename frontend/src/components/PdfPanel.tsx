// ABOUTME: PDF preview panel rendering via native browser iframe.
// ABOUTME: Minimal info bar with file name and size.

import { FilePlus2, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatFileSize } from "../api/redaction";

interface PdfPanelProps {
  file: File;
  label: string;
  onFileChange?: (file: File) => void;
}

export function PdfPanel({ file, label, onFileChange }: PdfPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected && onFileChange) {
        onFileChange(selected);
      }
      // Reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFileChange],
  );

  if (!blobUrl) return null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <iframe src={`${blobUrl}#toolbar=0`} className="flex-1 w-full bg-bg" title={label} />
      <div className="flex items-center gap-3 px-5 h-12 bg-bg border-t border-border">
        <FileText className="w-4 h-4 text-text-dim shrink-0" />
        <span className="text-sm text-text-sub truncate">{label}</span>
        <span className="text-sm text-text-faint font-mono shrink-0">
          {formatFileSize(file.size)}
        </span>
        {onFileChange && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-dim hover:text-text rounded-md hover:bg-surface transition-colors shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              New file
            </button>
          </>
        )}
      </div>
    </div>
  );
}
