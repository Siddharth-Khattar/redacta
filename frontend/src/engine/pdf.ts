// ABOUTME: MuPDF WASM wrapper for client-side PDF text extraction and redaction.
// ABOUTME: Lazy-loads the WASM module on first use via dynamic import.

import type { PDFDocument, PDFPage, Quad, Rect } from "mupdf";
import { type HighlightColor, RedactionEngineError, type RedactionTarget } from "./types";

type MupdfModule = typeof import("mupdf");

let mupdfModule: MupdfModule | null = null;

/** Lazy-load and cache the mupdf WASM module. */
async function getMupdf(): Promise<MupdfModule> {
  if (mupdfModule) return mupdfModule;

  try {
    mupdfModule = await import("mupdf");
    return mupdfModule;
  } catch (error) {
    throw new RedactionEngineError(
      "WASM_LOAD",
      `Failed to load PDF engine. Refresh the page. ${error instanceof Error ? error.message : ""}`,
    );
  }
}

/** Convert a Quad (8 numbers: 4 corner points) to a bounding Rect [x0, y0, x1, y1]. */
function quadToRect(quad: Quad): Rect {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = quad;
  return [
    Math.min(x0, x1, x2, x3),
    Math.min(y0, y1, y2, y3),
    Math.max(x0, x1, x2, x3),
    Math.max(y0, y1, y2, y3),
  ];
}

/** Extract text from each page of a PDF. Returns a Map of page number (1-indexed) to text. */
export async function extractText(pdfBytes: ArrayBuffer): Promise<Map<number, string>> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const pages = new Map<number, string>();

  try {
    const pageCount = doc.countPages();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const text = page.toStructuredText().asText();
      pages.set(i + 1, text);
    }
  } finally {
    doc.destroy();
  }

  return pages;
}

/**
 * Apply redactions to a PDF and return the modified document as bytes.
 *
 * Permanent mode: creates Redact annotations and applies them (destroys text beneath).
 * Visual mode: creates black-filled Square annotations (text remains underneath).
 */
export async function applyRedactions(
  pdfBytes: ArrayBuffer,
  targets: RedactionTarget[],
  permanent: boolean,
): Promise<Uint8Array> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  try {
    const pdfDoc = doc.asPDF() as PDFDocument | null;
    if (!pdfDoc) {
      throw new RedactionEngineError("WASM_LOAD", "Document is not a valid PDF.");
    }

    const pageCount = doc.countPages();

    // Group targets by 0-indexed page
    const targetsByPage = new Map<number, RedactionTarget[]>();
    for (const target of targets) {
      const pageIdx = target.page - 1;
      if (pageIdx < 0 || pageIdx >= pageCount) continue;
      const existing = targetsByPage.get(pageIdx) ?? [];
      existing.push(target);
      targetsByPage.set(pageIdx, existing);
    }

    for (const [pageIdx, pageTargets] of targetsByPage) {
      const page: PDFPage = pdfDoc.loadPage(pageIdx);

      if (permanent) {
        for (const target of pageTargets) {
          const hits: Quad[][] = page.search(target.text);
          if (hits.length === 0) continue;

          for (const quads of hits) {
            for (const quad of quads) {
              const annot = page.createAnnotation("Redact");
              annot.setRect(quadToRect(quad));
            }
          }
        }
        page.applyRedactions(true, 0); // REDACT_IMAGE_NONE = 0
      } else {
        for (const target of pageTargets) {
          const hits: Quad[][] = page.search(target.text);
          if (hits.length === 0) continue;

          for (const quads of hits) {
            for (const quad of quads) {
              const annot = page.createAnnotation("Square");
              annot.setRect(quadToRect(quad));
              annot.setColor([0, 0, 0]);
              annot.setInteriorColor([0, 0, 0]);
              annot.setBorderWidth(0);
              annot.setOpacity(1);
            }
          }
        }
      }
    }

    const buffer = pdfDoc.saveToBuffer("compress");
    return buffer.asUint8Array();
  } finally {
    doc.destroy();
  }
}

const HIGHLIGHT_COLORS: Record<HighlightColor, [number, number, number]> = {
  white: [1, 1, 1],
  blue: [0.86, 0.92, 1],
  green: [0.86, 0.99, 0.91],
  yellow: [1, 0.98, 0.76],
  pink: [0.99, 0.91, 0.96],
  purple: [0.95, 0.91, 1],
};

/**
 * Apply pseudonymisation to a PDF: replace identified text with pseudonym labels.
 *
 * Two-phase approach per page:
 * 1. Search all targets and collect positions before any mutations.
 * 2. Create Redact annotations to remove original text, then overlay FreeText
 *    annotations with the pseudonym labels at the stored positions.
 */
export async function applyPseudonymisation(
  pdfBytes: ArrayBuffer,
  targets: RedactionTarget[],
  highlightColor: HighlightColor,
): Promise<Uint8Array> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  try {
    const pdfDoc = doc.asPDF() as PDFDocument | null;
    if (!pdfDoc) {
      throw new RedactionEngineError("WASM_LOAD", "Document is not a valid PDF.");
    }

    const pageCount = doc.countPages();
    const bgColor = HIGHLIGHT_COLORS[highlightColor];

    // Group targets by 0-indexed page
    const targetsByPage = new Map<number, RedactionTarget[]>();
    for (const target of targets) {
      const pageIdx = target.page - 1;
      if (pageIdx < 0 || pageIdx >= pageCount) continue;
      const existing = targetsByPage.get(pageIdx) ?? [];
      existing.push(target);
      targetsByPage.set(pageIdx, existing);
    }

    for (const [pageIdx, pageTargets] of targetsByPage) {
      const page: PDFPage = pdfDoc.loadPage(pageIdx);

      // Phase 1: Collect all hit positions before any redactions
      const collected: Array<{ rect: Rect; pseudonym: string }> = [];

      for (const target of pageTargets) {
        const pseudonym = target.pseudonym ?? target.text;
        const hits: Quad[][] = page.search(target.text);
        if (hits.length === 0) continue;

        for (const quads of hits) {
          for (const quad of quads) {
            const rect = quadToRect(quad);
            collected.push({ rect, pseudonym });
          }
        }
      }

      // Phase 2a: Create Redact annotations to remove original text
      for (const { rect } of collected) {
        const annot = page.createAnnotation("Redact");
        annot.setRect(rect);
      }
      page.applyRedactions(true, 0); // REDACT_IMAGE_NONE = 0

      // Phase 2b: Overlay FreeText annotations with pseudonym labels.
      // FreeText annotations don't support interior color (IC), so we layer a
      // filled Square annotation underneath for the background highlight.
      for (const { rect, pseudonym } of collected) {
        const [x0, y0, x1, y1] = rect;
        const rectHeight = y1 - y0;
        const originalWidth = x1 - x0;
        const fontSize = rectHeight * 0.75;

        // Widen rect if the pseudonym label is longer than the original text
        const estimatedWidth = pseudonym.length * fontSize * 0.55;
        const finalWidth = Math.max(originalWidth, estimatedWidth);
        const finalRect: Rect = [x0, y0, x0 + finalWidth, y1];

        // Background: filled Square annotation
        const bg = page.createAnnotation("Square");
        bg.setRect(finalRect);
        bg.setColor(bgColor);
        bg.setInteriorColor(bgColor);
        bg.setBorderWidth(0);
        bg.setOpacity(1);
        bg.update();

        // Foreground: FreeText annotation with the pseudonym label
        const annot = page.createAnnotation("FreeText");
        annot.setRect(finalRect);
        annot.setContents(pseudonym);
        annot.setDefaultAppearance("Helv", fontSize, [0, 0, 0]);
        annot.setBorderWidth(0);
        annot.setQuadding(0); // Left-aligned
        annot.update();
      }
    }

    const buffer = pdfDoc.saveToBuffer("compress");
    return buffer.asUint8Array();
  } finally {
    doc.destroy();
  }
}
