// ABOUTME: MuPDF WASM wrapper for client-side PDF text extraction and redaction.
// ABOUTME: Lazy-loads the WASM module on first use via dynamic import.

import type { PDFDocument, PDFPage, Quad, Rect } from "mupdf";
import { RedactionEngineError, type RedactionTarget } from "./types";

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
