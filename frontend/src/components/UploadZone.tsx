// ABOUTME: Drag-and-drop PDF upload zone with dot-grid background.
// ABOUTME: Warm, inviting design with staggered entrance and gentle hover states.

import { ArrowUpRight, FileText, Lock, Sparkles } from "lucide-react";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
}

export function UploadZone({ onFileAccepted }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        onFileAccepted(file);
      }
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    multiple: false,
  });

  return (
    <div className="flex-1 flex items-center justify-center dot-grid relative">
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--color-bg)_100%)]" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Heading */}
        <div className="mb-8 stagger-1">
          <h2 className="text-3xl font-semibold text-text leading-snug mb-3 tracking-tight">
            Redact documents
            <br />
            <span className="text-redact">with precision</span>
          </h2>
          <p className="text-sm text-text-sub leading-relaxed">
            Upload a PDF and describe what to remove. Gemini identifies and redacts matching content
            while preserving structure.
          </p>
        </div>

        {/* Drop zone */}
        <div {...getRootProps()} className="stagger-2">
          <input {...getInputProps()} />
          <div
            className={`
              group flex items-center justify-between
              px-5 py-4 rounded-xl border cursor-pointer
              transition-all duration-200
              ${
                isDragActive
                  ? "border-redact bg-redact-soft"
                  : "border-border hover:border-text-dim bg-raised hover:bg-surface"
              }
            `}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-lg transition-colors
                  ${isDragActive ? "bg-redact-soft" : "bg-surface"}
                `}
              >
                <FileText
                  className={`w-5 h-5 transition-colors ${isDragActive ? "text-redact" : "text-text-dim group-hover:text-text-sub"}`}
                />
              </div>
              <div>
                <p
                  className={`text-sm font-medium transition-colors ${isDragActive ? "text-redact" : "text-text"}`}
                >
                  {isDragActive ? "Release to upload" : "Drop a PDF here"}
                </p>
                <p className="text-xs text-text-dim mt-0.5">or click to browse</p>
              </div>
            </div>

            <ArrowUpRight
              className={`
                w-4.5 h-4.5 transition-all duration-200
                ${isDragActive ? "text-redact" : "text-text-faint group-hover:text-text-dim group-hover:-translate-y-0.5 group-hover:translate-x-0.5"}
              `}
            />
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 flex items-center gap-5 stagger-3">
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <FileText className="w-3.5 h-3.5" />
            <span>PDF only</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini-powered</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <Lock className="w-3.5 h-3.5" />
            <span>Local processing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
