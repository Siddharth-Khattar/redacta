// ABOUTME: Mode-based selector for prompt modules.
// ABOUTME: Routes to redaction or pseudonymisation prompts based on the processing mode.

import type { ProcessingMode } from "../types";
import * as pseudonymisation from "./pseudonymisation";
import * as redaction from "./redaction";

export function getSystemInstruction(mode: ProcessingMode, thorough = false): string {
  return mode === "pseudonymise"
    ? pseudonymisation.getSystemInstruction(thorough)
    : redaction.getSystemInstruction(thorough);
}

export function buildUserMessage(
  mode: ProcessingMode,
  pdfText: Map<number, string>,
  prompt: string,
): string {
  return mode === "pseudonymise"
    ? pseudonymisation.buildUserMessage(pdfText, prompt)
    : redaction.buildUserMessage(pdfText, prompt);
}
