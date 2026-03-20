// ABOUTME: Split-pane layout container for the redaction workspace.
// ABOUTME: Draggable divider lets users resize left/right panes within 35–65% range.

import { type ReactNode, useCallback, useRef, useState } from "react";

const MIN_PCT = 35;
const MAX_PCT = 65;
const DEFAULT_PCT = 50;

interface RedactionWorkspaceProps {
  left: ReactNode;
  right: ReactNode;
}

export function RedactionWorkspace({ left, right }: RedactionWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(DEFAULT_PCT);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex overflow-hidden min-h-0"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={dragging ? { cursor: "col-resize", userSelect: "none" } : undefined}
    >
      <div
        className="border-r border-border overflow-hidden relative min-h-0"
        style={{ width: `${leftPct}%` }}
      >
        {left}
      </div>

      <div
        onPointerDown={onPointerDown}
        className="w-1.5 shrink-0 cursor-col-resize transition-colors relative z-10"
        style={{ backgroundColor: dragging ? "#3b82f6" : "#3b82f680" }}
      />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-raised">{right}</div>
    </div>
  );
}
