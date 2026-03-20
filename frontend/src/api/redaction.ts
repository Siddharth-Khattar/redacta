// ABOUTME: API client for PDF redaction operations.
// ABOUTME: Handles file upload, redaction submission, and response utilities.

export const RATE_LIMIT_ERROR_MESSAGE =
  "Our AI service is currently experiencing high demand. Please wait a moment and try again.";

export interface RedactionTarget {
  text: string;
  page: number;
  context: string | null;
}

export interface RedactionResponse {
  redacted_pdf: string;
  redaction_count: number;
  targets: RedactionTarget[];
  reasoning: string | null;
  permanent: boolean;
}

interface RedactionError {
  detail: string;
}

export type GeminiModel = "gemini-2.0-flash" | "gemini-3-flash-preview" | "gemini-3.1-pro-preview";

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export const GEMINI_MODELS: { id: GeminiModel; label: string }[] = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-3-flash-preview", label: "Gemini 3.0 Flash" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

export const THINKING_LEVELS: { id: ThinkingLevel; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

/**
 * Redact a PDF file using natural language instructions.
 */
export async function redactPdf(
  file: File,
  prompt: string,
  permanent: boolean,
  model: GeminiModel = "gemini-2.0-flash",
  thinkingLevel: ThinkingLevel = "low",
): Promise<RedactionResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("prompt", prompt);
  formData.append("permanent", String(permanent));
  formData.append("model", model);
  formData.append("thinking_level", thinkingLevel);

  let response: Response;
  try {
    response = await fetch("/api/redact/pdf", {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new Error(`Network error: ${message}. Is the backend running on port 8000?`);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(RATE_LIMIT_ERROR_MESSAGE);
    }
    let errorDetail: string;
    try {
      const errorData: RedactionError = await response.json();
      errorDetail = errorData.detail;
    } catch {
      errorDetail = `Server returned ${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

/**
 * Convert a base64 string to a blob URL for PDF display.
 * Caller is responsible for revoking the URL via URL.revokeObjectURL.
 */
export function base64ToBlobUrl(base64: string): string {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * Trigger a browser download from a blob URL or base64 data.
 */
export function downloadFromBase64(base64: string, filename: string): void {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
