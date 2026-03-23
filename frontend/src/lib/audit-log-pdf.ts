// ABOUTME: Generates a formatted A4 PDF audit report from a redaction audit log.
// ABOUTME: Lazy-loaded boundary module, dynamically imported on "Export as PDF" click.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { AuditLog, AuditLogTarget } from "./audit-log";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 40;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const PAGE_BREAK_THRESHOLD = A4_HEIGHT - 100;

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLOR_DARK: [number, number, number] = [30, 30, 30];
const COLOR_GRAY: [number, number, number] = [120, 120, 120];
const COLOR_LIGHT_GRAY: [number, number, number] = [200, 200, 200];
const COLOR_HEADER_BG: [number, number, number] = [50, 50, 50];
const COLOR_ALT_ROW: [number, number, number] = [248, 248, 248];

// ---------------------------------------------------------------------------
// Helper: format file size
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Helper: format duration
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Helper: title case a string
// ---------------------------------------------------------------------------

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Helper: safely extract lastAutoTable.finalY
// ---------------------------------------------------------------------------

interface DocWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

function getAutoTableFinalY(doc: jsPDF): number {
  return (doc as DocWithAutoTable).lastAutoTable.finalY;
}

// ---------------------------------------------------------------------------
// Helper: check page break and add new page if needed
// ---------------------------------------------------------------------------

function ensureSpace(doc: jsPDF, y: number, needed: number = 0): number {
  if (y + needed > PAGE_BREAK_THRESHOLD) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Helper: add section heading with underline
// ---------------------------------------------------------------------------

function addSectionHeading(doc: jsPDF, title: string, y: number): number {
  let currentY = ensureSpace(doc, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_DARK);
  doc.text(title, PAGE_MARGIN, currentY);

  currentY += 2;
  doc.setDrawColor(...COLOR_LIGHT_GRAY);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, currentY, A4_WIDTH - PAGE_MARGIN, currentY);

  currentY += 12;
  return currentY;
}

// ---------------------------------------------------------------------------
// Helper: add key-value pairs
// ---------------------------------------------------------------------------

function addKeyValuePairs(
  doc: jsPDF,
  pairs: Array<{ key: string; value: string }>,
  y: number,
): number {
  const lineHeight = 14;
  const valueX = PAGE_MARGIN + 120;
  let currentY = y;

  for (const pair of pairs) {
    currentY = ensureSpace(doc, currentY, lineHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_GRAY);
    doc.text(pair.key, PAGE_MARGIN, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_DARK);
    doc.text(pair.value, valueX, currentY);

    currentY += lineHeight;
  }

  return currentY;
}

// ---------------------------------------------------------------------------
// Helper: add wrapped text block
// ---------------------------------------------------------------------------

function addWrappedText(doc: jsPDF, text: string, y: number): number {
  let currentY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_DARK);

  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];

  for (const line of lines) {
    currentY = ensureSpace(doc, currentY, 12);
    doc.text(line, PAGE_MARGIN, currentY);
    currentY += 11;
  }

  return currentY;
}

// ---------------------------------------------------------------------------
// Helper: capitalize mode name for display
// ---------------------------------------------------------------------------

function formatModeName(mode: string): string {
  if (mode === "pseudonymise") return "Pseudonymisation";
  return "Redaction";
}

// ---------------------------------------------------------------------------
// Helper: format permanent flag
// ---------------------------------------------------------------------------

function formatPermanent(permanent: boolean): string {
  return permanent ? "Yes (text removed)" : "No (visual overlay)";
}

// ---------------------------------------------------------------------------
// Footer pass: render footer on every page after all content is placed
// ---------------------------------------------------------------------------

function renderFooters(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRAY);

    const footerY = A4_HEIGHT - 20;
    doc.text("Redacta Audit Report", PAGE_MARGIN, footerY);
    doc.text(`Page ${i} of ${totalPages}`, A4_WIDTH - PAGE_MARGIN, footerY, { align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Build targets table body rows
// ---------------------------------------------------------------------------

function buildTargetRows(targets: AuditLogTarget[], isPseudo: boolean): Array<Array<string>> {
  return targets.map((t) => {
    const base = [String(t.index), t.text, String(t.page), t.context ?? "", t.category ?? ""];
    if (isPseudo) {
      base.push(t.pseudonym ?? "");
    }
    return base;
  });
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportAsPdf(log: AuditLog): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  let y = PAGE_MARGIN;
  const isPseudo = log.processing.mode === "pseudonymise";

  // -----------------------------------------------------------------------
  // 1. Header
  // -----------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_DARK);
  doc.text("Redaction Audit Report", PAGE_MARGIN, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_GRAY);
  doc.text(`Exported: ${log.exportedAt}`, PAGE_MARGIN, y);
  y += 24;

  // -----------------------------------------------------------------------
  // 2. Source File
  // -----------------------------------------------------------------------
  y = addSectionHeading(doc, "Source File", y);
  y = addKeyValuePairs(
    doc,
    [
      { key: "Filename", value: log.source.filename },
      { key: "Size", value: formatFileSize(log.source.sizeBytes) },
      { key: "Pages", value: String(log.source.pageCount) },
    ],
    y,
  );
  y += 8;

  // -----------------------------------------------------------------------
  // 3. Processing Configuration
  // -----------------------------------------------------------------------
  y = addSectionHeading(doc, "Processing Configuration", y);
  y = addKeyValuePairs(
    doc,
    [
      { key: "Mode", value: formatModeName(log.processing.mode) },
      { key: "Permanent", value: formatPermanent(log.processing.permanent) },
      { key: "Provider", value: log.processing.provider },
      { key: "Model", value: log.processing.model },
      { key: "Thinking Level", value: log.processing.thinkingLevel },
      { key: "Thoroughness", value: toTitleCase(log.processing.thoroughness) },
      { key: "Preset", value: log.processing.preset ?? "Custom" },
      { key: "Image Removal", value: log.processing.redactImages ? "Enabled" : "Disabled" },
    ],
    y,
  );
  y += 8;

  // -----------------------------------------------------------------------
  // 4. Prompt
  // -----------------------------------------------------------------------
  y = addSectionHeading(doc, "Prompt", y);
  y = addWrappedText(doc, log.processing.prompt, y);
  y += 8;

  // -----------------------------------------------------------------------
  // 5. Results Summary
  // -----------------------------------------------------------------------
  y = addSectionHeading(doc, "Results Summary", y);
  y = addKeyValuePairs(
    doc,
    [
      { key: "Total Targets", value: String(log.results.stats.totalTargets) },
      { key: "Pages Affected", value: String(log.results.stats.pagesAffected) },
      { key: "Image Redactions", value: String(log.results.imageRedactions.identified) },
    ],
    y,
  );
  y += 8;

  // -----------------------------------------------------------------------
  // 6. Reasoning
  // -----------------------------------------------------------------------
  if (log.results.reasoning) {
    y = addSectionHeading(doc, "Reasoning", y);
    y = addWrappedText(doc, log.results.reasoning, y);
    y += 8;
  }

  // -----------------------------------------------------------------------
  // 7. Targets Table
  // -----------------------------------------------------------------------
  y = addSectionHeading(doc, "Targets", y);

  const targetHead = isPseudo
    ? [["#", "Text", "Page", "Context", "Category", "Pseudonym"]]
    : [["#", "Text", "Page", "Context", "Category"]];

  const targetBody = buildTargetRows(log.results.targets, isPseudo);

  const columnStyles: Record<number, Partial<{ cellWidth: number; halign: string }>> = {
    0: { cellWidth: 30 },
  };

  // Page column index: 2 for both modes
  columnStyles[2] = { cellWidth: 35, halign: "center" };

  autoTable(doc, {
    startY: y,
    head: targetHead,
    body: targetBody,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLOR_HEADER_BG,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: COLOR_ALT_ROW,
    },
    columnStyles: columnStyles as Record<string, Partial<import("jspdf-autotable").Styles>>,
  });

  y = getAutoTableFinalY(doc) + 16;

  // -----------------------------------------------------------------------
  // 8. Mapping Table (pseudonymisation only)
  // -----------------------------------------------------------------------
  if (isPseudo && log.mapping) {
    y = ensureSpace(doc, y, 60);
    y = addSectionHeading(doc, "Pseudonym Mapping", y);

    const mappingBody = Object.entries(log.mapping).map(([pseudonym, original]) => [
      pseudonym,
      original,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Pseudonym", "Original"]],
      body: mappingBody,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: COLOR_HEADER_BG,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: COLOR_ALT_ROW,
      },
    });

    y = getAutoTableFinalY(doc) + 16;
  }

  // -----------------------------------------------------------------------
  // 9. Usage Statistics
  // -----------------------------------------------------------------------
  y = ensureSpace(doc, y, 60);
  y = addSectionHeading(doc, "Usage Statistics", y);

  y = addKeyValuePairs(
    doc,
    [
      { key: "Model", value: log.processing.model },
      { key: "Input Tokens", value: log.usage.inputTokens.toLocaleString("en-US") },
      { key: "Output Tokens", value: log.usage.outputTokens.toLocaleString("en-US") },
      { key: "Thinking Tokens", value: log.usage.thinkingTokens.toLocaleString("en-US") },
      { key: "Total Tokens", value: log.usage.totalTokens.toLocaleString("en-US") },
      { key: "LLM Duration", value: formatDuration(log.usage.llmDurationMs) },
      { key: "Total Duration", value: formatDuration(log.usage.totalDurationMs) },
    ],
    y,
  );

  // -----------------------------------------------------------------------
  // 10. Footer pass on every page
  // -----------------------------------------------------------------------
  renderFooters(doc);

  return doc.output("blob");
}
