// ABOUTME: MuPDF WASM wrapper for client-side PDF text extraction and redaction.
// ABOUTME: Lazy-loads the WASM module on first use via dynamic import.

import type { PDFDocument, PDFPage, Quad, Rect } from "mupdf";
import {
  type BoundingRect,
  type HighlightColor,
  type ImageFillColor,
  type ImageRedactionSettings,
  type ImageTarget,
  RedactionEngineError,
  type RedactionTarget,
} from "./types";

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

// ── Image fill color mapping ──────────────────────────────────────────

const IMAGE_FILL_COLORS: Record<ImageFillColor, [number, number, number]> = {
  white: [1, 1, 1],
  lightgray: [0.92, 0.92, 0.92],
  black: [0, 0, 0],
};

const IMAGE_BORDER_COLOR: [number, number, number] = [0.78, 0.78, 0.78];
const IMAGE_LABEL_COLOR: [number, number, number] = [0.55, 0.55, 0.55];

// ── Image detection ───────────────────────────────────────────────────

/** Detect all images across every page. Returns a stable list of ImageTargets. */
export async function detectImages(pdfBytes: ArrayBuffer): Promise<ImageTarget[]> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const targets: ImageTarget[] = [];

  try {
    const pageCount = doc.countPages();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      let imageIndex = 0;
      page.toStructuredText("preserve-images").walk({
        onImageBlock(bbox: Rect) {
          targets.push({
            id: `p${i + 1}-${imageIndex}`,
            page: i + 1,
            rect: bbox as BoundingRect,
          });
          imageIndex++;
        },
      });
    }
  } finally {
    doc.destroy();
  }

  return targets;
}

// ── Styled image annotation helpers ───────────────────────────────────

/** Create styled overlay annotations for a redacted image area. */
function createImageOverlay(page: PDFPage, rect: Rect, settings: ImageRedactionSettings) {
  const fillColor = IMAGE_FILL_COLORS[settings.fillColor];

  // Filled rectangle with thin border
  const overlay = page.createAnnotation("Square");
  overlay.setRect(rect);
  overlay.setColor(IMAGE_BORDER_COLOR);
  overlay.setInteriorColor(fillColor);
  overlay.setBorderWidth(0.5);
  overlay.setOpacity(1);
  overlay.update();

  // Centered label text
  if (settings.showLabel && settings.label) {
    const [x0, y0, x1, y1] = rect;
    const rectWidth = x1 - x0;
    const rectHeight = y1 - y0;
    const fontSize = Math.max(6, Math.min(14, Math.min(rectWidth, rectHeight) * 0.1));
    const textHeight = fontSize * 2;
    const centerY = (y0 + y1) / 2;

    // Determine label text color: use lighter text on black fill, darker on light fills
    const labelColor: [number, number, number] =
      settings.fillColor === "black" ? [0.45, 0.45, 0.45] : IMAGE_LABEL_COLOR;

    const label = page.createAnnotation("FreeText");
    label.setRect([x0, centerY - textHeight / 2, x1, centerY + textHeight / 2]);
    label.setContents(settings.label);
    label.setDefaultAppearance("Helv", fontSize, labelColor);
    label.setBorderWidth(0);
    label.setQuadding(1); // Center-aligned
    label.update();
  }
}

/**
 * Apply image redactions on a single page.
 *
 * For permanent mode, creates Redact annotations (caller must call applyRedactions after).
 * For visual mode, creates styled overlay annotations directly.
 */
/**
 * Create Redact annotations for images on a page (permanent mode only).
 * Returns the list of image targets that were marked for redaction.
 * Caller must call applyRedactions after, then addImageOverlays to draw labels.
 */
function markPageImagesForRedaction(
  page: PDFPage,
  pageNumber: number,
  imageTargets: ImageTarget[],
  excludedImageIds: Set<string>,
): ImageTarget[] {
  const pageImages = imageTargets.filter(
    (t) => t.page === pageNumber && !excludedImageIds.has(t.id),
  );
  for (const img of pageImages) {
    const annot = page.createAnnotation("Redact");
    annot.setRect(img.rect as Rect);
  }
  return pageImages;
}

/** Create styled overlay annotations for previously redacted images. */
function addImageOverlays(page: PDFPage, images: ImageTarget[], settings: ImageRedactionSettings) {
  for (const img of images) {
    createImageOverlay(page, img.rect as Rect, settings);
  }
}

/**
 * Apply image redactions on a single page (visual/non-permanent mode only).
 * Creates styled overlays directly without destroying the image.
 */
function processPageImagesVisual(
  page: PDFPage,
  pageNumber: number,
  imageTargets: ImageTarget[],
  settings: ImageRedactionSettings,
) {
  const excluded = new Set(settings.excludedImageIds);
  const pageImages = imageTargets.filter((t) => t.page === pageNumber && !excluded.has(t.id));

  if (pageImages.length === 0) return;

  for (const img of pageImages) {
    createImageOverlay(page, img.rect as Rect, settings);
  }
}

// ── Text extraction ───────────────────────────────────────────────────

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

// ── Redaction ─────────────────────────────────────────────────────────

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
  imageTargets: ImageTarget[],
  imageSettings: ImageRedactionSettings | null,
): Promise<Uint8Array> {
  const mupdf = await getMupdf();
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

  try {
    const pdfDoc = doc.asPDF() as PDFDocument | null;
    if (!pdfDoc) {
      throw new RedactionEngineError("WASM_LOAD", "Document is not a valid PDF.");
    }

    const pageCount = doc.countPages();

    // Group text targets by 0-indexed page
    const targetsByPage = new Map<number, RedactionTarget[]>();
    for (const target of targets) {
      const pageIdx = target.page - 1;
      if (pageIdx < 0 || pageIdx >= pageCount) continue;
      const existing = targetsByPage.get(pageIdx) ?? [];
      existing.push(target);
      targetsByPage.set(pageIdx, existing);
    }

    // Determine which pages need processing
    const hasImages = imageSettings !== null && imageTargets.length > 0;
    const imagePagesNeeded = hasImages
      ? new Set(imageTargets.map((t) => t.page - 1))
      : new Set<number>();

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const pageTargets = targetsByPage.get(pageIdx);
      const hasTextTargets = pageTargets && pageTargets.length > 0;
      const needsImageProcessing = imagePagesNeeded.has(pageIdx);

      if (!hasTextTargets && !needsImageProcessing) continue;

      const page: PDFPage = pdfDoc.loadPage(pageIdx);

      const excluded = imageSettings ? new Set(imageSettings.excludedImageIds) : new Set<string>();

      if (permanent) {
        if (hasTextTargets) {
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
        }

        // Mark images for redaction (Redact annotations only, no overlays yet)
        let redactedImages: ImageTarget[] = [];
        if (needsImageProcessing && imageSettings) {
          redactedImages = markPageImagesForRedaction(page, pageIdx + 1, imageTargets, excluded);
        }

        if (hasTextTargets || redactedImages.length > 0) {
          page.applyRedactions(true, 2); // REDACT_IMAGE_REMOVE
        }

        // Now that images are destroyed, add styled overlays on top
        if (redactedImages.length > 0 && imageSettings) {
          addImageOverlays(page, redactedImages, imageSettings);
        }
      } else {
        if (hasTextTargets) {
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

        if (needsImageProcessing && imageSettings) {
          processPageImagesVisual(page, pageIdx + 1, imageTargets, imageSettings);
        }
      }
    }

    const buffer = pdfDoc.saveToBuffer("compress");
    return buffer.asUint8Array();
  } finally {
    doc.destroy();
  }
}

// ── Pseudonymisation ──────────────────────────────────────────────────

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
  imageTargets: ImageTarget[],
  imageSettings: ImageRedactionSettings | null,
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

    // Group text targets by 0-indexed page
    const targetsByPage = new Map<number, RedactionTarget[]>();
    for (const target of targets) {
      const pageIdx = target.page - 1;
      if (pageIdx < 0 || pageIdx >= pageCount) continue;
      const existing = targetsByPage.get(pageIdx) ?? [];
      existing.push(target);
      targetsByPage.set(pageIdx, existing);
    }

    const hasImages = imageSettings !== null && imageTargets.length > 0;
    const imagePagesNeeded = hasImages
      ? new Set(imageTargets.map((t) => t.page - 1))
      : new Set<number>();

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const pageTargets = targetsByPage.get(pageIdx);
      const hasTextTargets = pageTargets && pageTargets.length > 0;
      const needsImageProcessing = imagePagesNeeded.has(pageIdx);

      if (!hasTextTargets && !needsImageProcessing) continue;

      const page: PDFPage = pdfDoc.loadPage(pageIdx);

      // Phase 1: Collect all text hit positions before any redactions
      const collected: Array<{ rect: Rect; pseudonym: string }> = [];

      if (hasTextTargets) {
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
      }

      const excluded = imageSettings ? new Set(imageSettings.excludedImageIds) : new Set<string>();

      // Phase 2a: Create Redact annotations to remove original text and images
      for (const { rect } of collected) {
        const annot = page.createAnnotation("Redact");
        annot.setRect(rect);
      }

      let redactedImages: ImageTarget[] = [];
      if (needsImageProcessing && imageSettings) {
        redactedImages = markPageImagesForRedaction(page, pageIdx + 1, imageTargets, excluded);
      }

      if (collected.length > 0 || redactedImages.length > 0) {
        page.applyRedactions(true, 2); // REDACT_IMAGE_REMOVE
      }

      // Add styled image overlays after redaction has destroyed the images
      if (redactedImages.length > 0 && imageSettings) {
        addImageOverlays(page, redactedImages, imageSettings);
      }

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
