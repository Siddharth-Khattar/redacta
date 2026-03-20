// ABOUTME: Split-pane layout container for the redaction workspace.
// ABOUTME: Left pane (58%) for PDF preview, right pane (42%) for controls.

import type { ReactNode } from "react";

interface RedactionWorkspaceProps {
  left: ReactNode;
  right: ReactNode;
}

export function RedactionWorkspace({ left, right }: RedactionWorkspaceProps) {
  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div className="w-[58%] border-r border-border overflow-hidden relative min-h-0">{left}</div>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-raised">{right}</div>
    </div>
  );
}
