// ABOUTME: PDF preview panel rendering via native browser iframe.
// ABOUTME: Minimal info bar with file name and size.

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { formatFileSize } from "../api/redaction";

interface PdfPanelProps {
  file: File;
  label: string;
}

export function PdfPanel({ file, label }: PdfPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!blobUrl) return null;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-2 bg-bg border-b border-border">
        <FileText className="w-3.5 h-3.5 text-text-dim" />
        <span className="text-xs text-text-sub truncate">{label}</span>
        <span className="text-xs text-text-faint ml-auto font-mono shrink-0">
          {formatFileSize(file.size)}
        </span>
      </div>
      <iframe src={blobUrl} className="flex-1 w-full bg-bg" title={label} />
    </div>
  );
}
