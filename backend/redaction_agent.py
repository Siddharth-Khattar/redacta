# ABOUTME: PDF Redaction Agent using Gemini for intelligent content identification.
# ABOUTME: Processes PDF files and redacts specified information with black boxes.

import json
import logging
import time
from pathlib import Path
from typing import cast

import fitz  # PyMuPDF
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from retry import with_gemini_rate_limit_retry

logger = logging.getLogger(__name__)


class RedactionTarget(BaseModel):
    """A single piece of content to redact from the PDF."""

    text: str = Field(description="Exact text to redact")
    page: int = Field(description="Page number (1-indexed)")
    context: str | None = Field(default=None, description="Surrounding context for disambiguation")


class UsageStats(BaseModel):
    """Token usage and timing metrics from a Gemini call."""

    input_tokens: int = 0
    output_tokens: int = 0
    thinking_tokens: int = 0
    total_tokens: int = 0
    model: str = ""
    duration_ms: int = 0


class RedactionResponse(BaseModel):
    """Structured response from Gemini identifying content to redact."""

    targets: list[RedactionTarget] = Field(
        description="List of text segments to redact with page numbers"
    )
    reasoning: str | None = Field(default=None, description="Explanation of redaction decisions")


class PDFRedactionAgent:
    """PDF redaction agent powered by Gemini.

    Pipeline:
    1. Extracts text from PDF with page numbers
    2. Uses Gemini to identify content matching redaction criteria
    3. Applies black box redactions to the PDF
    """

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.client = genai.Client(api_key=self.api_key)

    def extract_pdf_text(self, pdf_path: str) -> dict[int, str]:
        """Extract text from PDF with page numbers (1-indexed)."""
        doc = fitz.open(pdf_path)
        pages: dict[int, str] = {}

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = cast(str, page.get_text())
            pages[page_num + 1] = text

        doc.close()
        return pages

    @with_gemini_rate_limit_retry
    def identify_redactions(
        self,
        pdf_text: dict[int, str],
        redaction_prompt: str,
        thinking_level: str = "low",
    ) -> tuple[RedactionResponse, UsageStats]:
        """Use Gemini to identify content that should be redacted."""
        pdf_content = "\n\n".join(
            [f"=== PAGE {page} ===\n{text}" for page, text in pdf_text.items()]
        )

        system_instruction = """\
You are a precise document redaction assistant. \
Your task is to identify EXACT text segments that should be \
redacted based on user instructions.

CRITICAL REQUIREMENTS:
1. Return EXACT text as it appears in the document (word-for-word)
2. Include the correct page number (1-indexed)
3. For ambiguous cases, include surrounding context
4. Be conservative - only redact what clearly matches the criteria
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
}"""

        user_message = f"""DOCUMENT CONTENT:
{pdf_content}

REDACTION INSTRUCTIONS:
{redaction_prompt}

Identify all text segments that match the redaction criteria. Return a JSON object with:
- targets: array of {{text, page, context}} objects
- reasoning: brief explanation of your decisions"""

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_message)],
            )
        ]

        # Gemini 3+ models support thinking levels; 2.x models do not
        thinking_config = None
        if not self.model.startswith("gemini-2"):
            thinking_config = types.ThinkingConfig(
                thinking_level=cast(types.ThinkingLevel, thinking_level)
            )

        generate_content_config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            thinking_config=thinking_config,
        )

        full_response = ""
        last_chunk = None
        start_time = time.monotonic()

        for chunk in self.client.models.generate_content_stream(
            model=self.model,
            contents=contents,
            config=generate_content_config,
        ):
            last_chunk = chunk
            if chunk.text:
                full_response += chunk.text

        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.info(f"Gemini response length: {len(full_response)} chars")

        usage = UsageStats(model=self.model, duration_ms=duration_ms)
        if last_chunk and last_chunk.usage_metadata:
            meta = last_chunk.usage_metadata
            usage.input_tokens = meta.prompt_token_count or 0
            usage.output_tokens = meta.candidates_token_count or 0
            usage.thinking_tokens = meta.thoughts_token_count or 0
            usage.total_tokens = meta.total_token_count or 0

        try:
            response_data = json.loads(full_response)
            return RedactionResponse(**response_data), usage
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse Gemini response: {e}")
            logger.error(f"Raw response length: {len(full_response)} chars")
            return RedactionResponse(
                targets=[], reasoning=f"Failed to parse response: {str(e)}"
            ), usage

    def apply_redactions(
        self,
        pdf_path: str,
        redaction_targets: list[RedactionTarget],
        output_path: str | None = None,
        permanent: bool = False,
    ) -> str:
        """Apply black box redactions to the PDF.

        Args:
            pdf_path: Path to input PDF
            redaction_targets: List of RedactionTarget objects
            output_path: Path for output PDF (defaults to input_redacted.pdf)
            permanent: If True, permanently removes text content beneath redactions

        Returns:
            Path to the redacted PDF file
        """
        if output_path is None:
            base = Path(pdf_path)
            output_path = str(base.parent / f"{base.stem}_redacted{base.suffix}")

        doc = fitz.open(pdf_path)

        targets_by_page: dict[int, list[RedactionTarget]] = {}
        for target in redaction_targets:
            page_idx = target.page - 1
            if page_idx < 0 or page_idx >= len(doc):
                logger.warning(f"Page {target.page} out of range, skipping target")
                continue
            if page_idx not in targets_by_page:
                targets_by_page[page_idx] = []
            targets_by_page[page_idx].append(target)

        for page_idx, targets in targets_by_page.items():
            page = doc[page_idx]

            if permanent:
                for target in targets:
                    text_instances = page.search_for(target.text)
                    if not text_instances:
                        logger.warning(f"Text not found on page {target.page}, skipping target")
                        continue

                    for rect in text_instances:
                        page.add_redact_annot(rect, fill=(0, 0, 0))

                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)  # type: ignore[attr-defined]
            else:
                for target in targets:
                    text_instances = page.search_for(target.text)
                    if not text_instances:
                        logger.warning(f"Text not found on page {target.page}, skipping target")
                        continue

                    for rect in text_instances:
                        page.draw_rect(
                            rect,
                            color=(0, 0, 0),
                            fill=(0, 0, 0),
                            width=0,
                        )

        doc.save(
            output_path,
            garbage=4,
            deflate=True,
            clean=True,
        )
        doc.close()

        logger.info(f"Redacted PDF saved to: {output_path}")
        return output_path

    def redact_pdf(
        self,
        pdf_path: str,
        redaction_prompt: str,
        output_path: str | None = None,
        permanent: bool = False,
        thinking_level: str = "low",
    ) -> tuple[str, RedactionResponse, UsageStats]:
        """Complete redaction workflow: extract text, identify targets, apply redactions."""
        logger.info(f"Starting redaction for: {pdf_path}")

        pdf_text = self.extract_pdf_text(pdf_path)
        logger.info(f"Extracted text from {len(pdf_text)} pages")

        redaction_response, usage = self.identify_redactions(
            pdf_text, redaction_prompt, thinking_level
        )
        logger.info(f"Identified {len(redaction_response.targets)} redaction targets")

        output_file = self.apply_redactions(
            pdf_path, redaction_response.targets, output_path, permanent
        )

        return output_file, redaction_response, usage
