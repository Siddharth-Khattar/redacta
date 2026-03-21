// ABOUTME: Processed PDF preview panel with success indicator and optional mapping legend.
// ABOUTME: Renders the redacted/pseudonymised PDF with post-processing controls for highlight colors and image settings.

import { CheckCircle, ChevronDown, ChevronUp, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  base64ToBlobUrl,
  type HighlightColor,
  type ImageFillColor,
  type ImageRedactionSettings,
  type RedactionResponse,
} from "../api/redaction";

const HIGHLIGHT_COLORS: { value: HighlightColor; bg: string; ring: string }[] = [
  { value: "white", bg: "bg-white", ring: "ring-white" },
  { value: "blue", bg: "bg-blue-400", ring: "ring-blue-400" },
  { value: "green", bg: "bg-green-400", ring: "ring-green-400" },
  { value: "yellow", bg: "bg-yellow-300", ring: "ring-yellow-300" },
  { value: "pink", bg: "bg-pink-400", ring: "ring-pink-400" },
  { value: "purple", bg: "bg-purple-400", ring: "ring-purple-400" },
];

const IMAGE_FILL_OPTIONS: {
  value: ImageFillColor;
  label: string;
  bg: string;
  ring: string;
}[] = [
  {
    value: "white",
    label: "White",
    bg: "bg-white border-gray-800",
    ring: "ring-white",
  },
  {
    value: "lightgray",
    label: "Gray",
    bg: "bg-gray-300",
    ring: "ring-gray-300",
  },
  {
    value: "black",
    label: "Black",
    bg: "bg-gray-900 border-gray-200",
    ring: "ring-gray-500",
  },
];

interface ResultPanelProps {
  result: RedactionResponse;
  onRerender: (updates: {
    highlightColor?: HighlightColor;
    imageSettings?: ImageRedactionSettings;
  }) => Promise<void>;
}

export function ResultPanel({ result, onRerender }: ResultPanelProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [showImageSettings, setShowImageSettings] = useState(false);
  const [rerendering, setRerendering] = useState(false);

  const isPseudo = result.mode === "pseudonymise";
  const mappingEntries = result.mapping ? Object.entries(result.mapping) : [];
  const hasMappings = isPseudo && mappingEntries.length > 0;
  const hasImages = result.imageTargets.length > 0;

  // Local image settings state for the label input
  const [labelDraft, setLabelDraft] = useState(result.imageSettings.label);

  const doRerender = async (updates: Parameters<typeof onRerender>[0]) => {
    if (rerendering) return;
    setRerendering(true);
    try {
      await onRerender(updates);
    } finally {
      setRerendering(false);
    }
  };

  const handleHighlightColorChange = (color: HighlightColor) => {
    if (color === result.highlightColor || rerendering) return;
    doRerender({ highlightColor: color });
  };

  const handleImageFillChange = (fillColor: ImageFillColor) => {
    if (fillColor === result.imageSettings.fillColor || rerendering) return;
    doRerender({ imageSettings: { ...result.imageSettings, fillColor } });
  };

  const handleLabelToggle = () => {
    if (rerendering) return;
    doRerender({
      imageSettings: {
        ...result.imageSettings,
        showLabel: !result.imageSettings.showLabel,
      },
    });
  };

  // Debounce label changes — re-render 500ms after the user stops typing.
  // Use refs for values that shouldn't restart the debounce timer.
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageSettingsRef = useRef(result.imageSettings);
  const rerenderRef = useRef(doRerender);
  imageSettingsRef.current = result.imageSettings;
  rerenderRef.current = doRerender;

  useEffect(() => {
    if (labelDraft === imageSettingsRef.current.label) return;

    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => {
      rerenderRef.current({
        imageSettings: { ...imageSettingsRef.current, label: labelDraft },
      });
    }, 500);

    return () => {
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    };
  }, [labelDraft]);

  const handleImageToggle = (imageId: string) => {
    if (rerendering) return;
    const excluded = new Set(result.imageSettings.excludedImageIds);
    if (excluded.has(imageId)) {
      excluded.delete(imageId);
    } else {
      excluded.add(imageId);
    }
    doRerender({
      imageSettings: {
        ...result.imageSettings,
        excludedImageIds: [...excluded],
      },
    });
  };

  useEffect(() => {
    const url = base64ToBlobUrl(result.redacted_pdf);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.redacted_pdf]);

  // Sync label draft when external changes arrive
  useEffect(() => {
    setLabelDraft(result.imageSettings.label);
  }, [result.imageSettings.label]);

  if (!blobUrl) return null;

  const excludedSet = new Set(result.imageSettings.excludedImageIds);
  const activeImageCount = result.imageTargets.filter((t) => !excludedSet.has(t.id)).length;

  return (
    <div className="relative w-full h-full flex flex-col">
      <iframe src={`${blobUrl}#toolbar=0`} className="flex-1 w-full bg-bg" title="Processed PDF" />

      {/* Mapping legend (pseudonymise only) */}
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

      {/* Image settings panel */}
      {hasImages && showImageSettings && (
        <div className="border-t border-border bg-raised px-4 py-3 max-h-64 overflow-y-auto space-y-3">
          {/* Fill color */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-dim w-16 shrink-0">Fill</span>
            <div className="flex items-center gap-1.5">
              {IMAGE_FILL_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  disabled={rerendering}
                  onClick={() => handleImageFillChange(c.value)}
                  aria-label={`Fill: ${c.label}`}
                  className={`
                    w-5 h-5 rounded-full ${c.bg} border border-border transition-all duration-150
                    ${
                      result.imageSettings.fillColor === c.value
                        ? `ring-1.5 ${c.ring} ring-offset-1 ring-offset-bg scale-110`
                        : "opacity-50 hover:opacity-90 hover:scale-110"
                    }
                    ${rerendering ? "pointer-events-none" : "cursor-pointer"}
                  `}
                />
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-dim w-16 shrink-0">Label</span>
            <input
              type="text"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              disabled={rerendering || !result.imageSettings.showLabel}
              className={`
                flex-1 text-xs px-2 py-1 rounded border border-border bg-bg text-text
                focus:outline-none focus:border-text-dim transition-colors
                ${!result.imageSettings.showLabel ? "opacity-40" : ""}
              `}
              placeholder="Label text..."
            />
            <button
              type="button"
              role="switch"
              aria-checked={result.imageSettings.showLabel}
              onClick={handleLabelToggle}
              disabled={rerendering}
              className={`
                relative w-8 h-4.5 rounded-full transition-colors duration-200 shrink-0
                ${result.imageSettings.showLabel ? "bg-text-dim" : "bg-border"}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white
                  transition-transform duration-200 shadow-sm
                  ${result.imageSettings.showLabel ? "translate-x-3.5" : "translate-x-0"}
                `}
              />
            </button>
          </div>

          {/* Image checklist */}
          <div>
            <span className="text-xs font-medium text-text-dim mb-1.5 block">
              Images ({activeImageCount}/{result.imageTargets.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {result.imageTargets.map((img) => {
                const isExcluded = excludedSet.has(img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    disabled={rerendering}
                    onClick={() => handleImageToggle(img.id)}
                    className={`
                      px-2 py-1 rounded text-[11px] font-mono transition-all duration-150
                      ${
                        isExcluded
                          ? "bg-surface text-text-faint line-through"
                          : "bg-surface-hover text-text-sub ring-1 ring-border"
                      }
                      ${rerendering ? "pointer-events-none" : "cursor-pointer hover:bg-surface-hover"}
                    `}
                  >
                    p{img.page}#{img.id.split("-")[1]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-3 px-5 h-12 bg-bg border-t border-border">
        <CheckCircle className={`w-5 h-5 shrink-0 ${isPseudo ? "text-pseudo" : "text-done"}`} />
        <span className={`text-sm font-medium ${isPseudo ? "text-pseudo" : "text-done"}`}>
          {isPseudo ? "Pseudonymised" : "Redacted"}
        </span>

        {/* Highlight color dots (pseudonymise only) */}
        {isPseudo && (
          <div className="flex items-center gap-1.5 ml-1">
            {rerendering && <Loader2 className="w-3.5 h-3.5 text-text-dim animate-spin" />}
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                disabled={rerendering}
                onClick={() => handleHighlightColorChange(c.value)}
                aria-label={`Highlight: ${c.value}`}
                className={`
                  w-4 h-4 rounded-full ${c.bg} transition-all duration-150
                  ${
                    result.highlightColor === c.value
                      ? `ring-1.5 ${c.ring} ring-offset-1 ring-offset-bg scale-110`
                      : "opacity-40 hover:opacity-80 hover:scale-110"
                  }
                  ${rerendering ? "pointer-events-none" : "cursor-pointer"}
                `}
              />
            ))}
          </div>
        )}

        {/* Rerender spinner for non-pseudo mode */}
        {!isPseudo && rerendering && (
          <Loader2 className="w-3.5 h-3.5 text-text-dim animate-spin ml-1" />
        )}

        {result.reasoning && (
          <span className="text-sm text-text-faint truncate ml-2">{result.reasoning}</span>
        )}

        {/* Right-side buttons */}
        <div className="ml-auto flex items-center gap-3">
          {hasImages && (
            <button
              type="button"
              onClick={() => setShowImageSettings((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-text-dim hover:text-text-sub transition-colors"
            >
              <ImageOff className="w-3.5 h-3.5" />
              {activeImageCount} {activeImageCount === 1 ? "image" : "images"}
              {showImageSettings ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          )}
          {hasMappings && (
            <button
              type="button"
              onClick={() => setShowMapping((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-text-dim hover:text-text-sub transition-colors"
            >
              {mappingEntries.length} {mappingEntries.length === 1 ? "mapping" : "mappings"}
              {showMapping ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
