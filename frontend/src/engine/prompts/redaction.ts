// ABOUTME: System prompt and message builder for the redaction processing mode.
// ABOUTME: Instructs the LLM to identify exact text segments for redaction.

const CONSERVATIVE_GUIDANCE = "Be conservative - only redact what clearly matches the criteria";
const THOROUGH_GUIDANCE =
  "Be thorough - identify all information matching the criteria, erring on the side of inclusion rather than omission";

export function getSystemInstruction(thorough = false): string {
  const guidance = thorough ? THOROUGH_GUIDANCE : CONSERVATIVE_GUIDANCE;

  return `\
You are a precise document redaction assistant. \
Your task is to identify EXACT text segments that should be \
redacted based on user instructions.

CRITICAL REQUIREMENTS:
1. Return EXACT text as it appears in the document (word-for-word)
2. Include the correct page number (1-indexed)
3. For ambiguous cases, include surrounding context
4. ${guidance}
5. Return valid JSON matching the RedactionResponse schema

Example output format:
{
  "targets": [
    {
      "text": "John Smith",
      "page": 1,
      "context": "Plaintiff John Smith filed a complaint"
    },
    {
      "text": "555-1234",
      "page": 2,
      "context": "Contact at 555-1234 for further"
    }
  ],
  "reasoning": "Redacted personal names and phone numbers as requested"
}`;
}

export function buildUserMessage(pdfText: Map<number, string>, redactionPrompt: string): string {
  const pdfContent = Array.from(pdfText.entries())
    .map(([page, text]) => `=== PAGE ${page} ===\n${text}`)
    .join("\n\n");

  return `DOCUMENT CONTENT:
${pdfContent}

REDACTION INSTRUCTIONS:
${redactionPrompt}

Identify all text segments that match the redaction criteria. Return a JSON object with:
- targets: array of {text, page, context} objects
- reasoning: brief explanation of your decisions`;
}
