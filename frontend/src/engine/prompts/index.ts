// ABOUTME: Mode-based selector for prompt modules.
// ABOUTME: Routes to redaction or pseudonymisation prompts based on the processing mode.

import type { ProcessingMode } from "../types";
import * as pseudonymisation from "./pseudonymisation";
import * as redaction from "./redaction";

export function getSystemInstruction(mode: ProcessingMode): string {
  return mode === "pseudonymise"
    ? pseudonymisation.SYSTEM_INSTRUCTION
    : redaction.SYSTEM_INSTRUCTION;
}

export function buildUserMessage(
  mode: ProcessingMode,
  pdfText: Map<number, string>,
  prompt: string,
  existingMappings?: Record<string, string>,
): string {
  return mode === "pseudonymise"
    ? pseudonymisation.buildUserMessage(pdfText, prompt, existingMappings)
    : redaction.buildUserMessage(pdfText, prompt);
}
