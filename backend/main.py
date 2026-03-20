# ABOUTME: FastAPI application serving the PDF redaction API.
# ABOUTME: Single endpoint accepts PDF upload + prompt, returns base64 redacted PDF.

import base64
import contextlib
import logging
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import ClientError

from config import get_settings
from pricing import estimate_cost
from redaction_agent import PDFRedactionAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RATE_LIMIT_MESSAGE = (
    "The AI service is temporarily under high demand. Please try again in a few moments."
)

app = FastAPI(title="PDF Redaction API", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


ALLOWED_THINKING_LEVELS = {"minimal", "low", "medium", "high"}


@app.post("/api/redact/pdf", status_code=status.HTTP_200_OK)
async def redact_pdf(
    file: UploadFile = File(..., description="PDF file to redact"),
    prompt: str = Form(..., description="Natural language redaction instructions"),
    permanent: bool = Form(False, description="If true, permanently removes text"),
    model: str = Form("", description="Gemini model to use (empty = server default)"),
    thinking_level: str = Form("low", description="Thinking level: minimal, low, medium, high"),
):
    """Redact sensitive information from a PDF file.

    Accepts a PDF upload and redaction prompt, uses Gemini to identify
    matching content, applies black box redactions, and returns the
    redacted PDF as base64-encoded data.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported for redaction")

    if file.content_type and file.content_type != "application/pdf":
        logger.warning(f"Unexpected content type: {file.content_type}")

    # Resolve model: use form value if allowed, otherwise fall back to config default
    resolved_model = model.strip() if model.strip() else settings.gemini_model
    if resolved_model not in settings.allowed_models:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{resolved_model}' is not allowed. Allowed: {settings.allowed_models}",
        )

    # Validate thinking level
    if thinking_level not in ALLOWED_THINKING_LEVELS:
        allowed = sorted(ALLOWED_THINKING_LEVELS)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid thinking level '{thinking_level}'. Allowed: {allowed}",
        )

    temp_input = None
    temp_output = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_input = tmp.name

        logger.info(f"Processing redaction for: {file.filename}")
        logger.info(f"Prompt length: {len(prompt)} chars")
        logger.info(f"File size: {len(content)} bytes")

        agent = PDFRedactionAgent(
            api_key=settings.google_api_key,
            model=resolved_model,
        )

        output_path = temp_input.replace(".pdf", "_redacted.pdf")
        temp_output = output_path

        request_start = time.monotonic()

        output_file, response, usage = agent.redact_pdf(
            pdf_path=temp_input,
            redaction_prompt=prompt,
            output_path=output_path,
            permanent=permanent,
            thinking_level=thinking_level,
        )

        with open(output_file, "rb") as f:
            redacted_content = f.read()

        redacted_base64 = base64.b64encode(redacted_content).decode("utf-8")
        total_duration_ms = int((time.monotonic() - request_start) * 1000)
        cost_usd, pricing_source = estimate_cost(
            usage.model, usage.input_tokens, usage.output_tokens, usage.thinking_tokens
        )

        logger.info(f"Redaction complete: {len(response.targets)} items redacted")

        return {
            "redacted_pdf": redacted_base64,
            "redaction_count": len(response.targets),
            "targets": [
                {
                    "text": t.text[:100] + "..." if len(t.text) > 100 else t.text,
                    "page": t.page,
                    "context": (
                        t.context[:100] + "..." if t.context and len(t.context) > 100 else t.context
                    ),
                }
                for t in response.targets
            ],
            "reasoning": response.reasoning,
            "permanent": permanent,
            "usage": {
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "thinking_tokens": usage.thinking_tokens,
                "total_tokens": usage.total_tokens,
                "model": usage.model,
                "gemini_duration_ms": usage.duration_ms,
                "total_duration_ms": total_duration_ms,
                "estimated_cost_usd": cost_usd,
                "pricing_source": pricing_source,
            },
        }

    except ClientError as e:
        if e.code == 429:
            logger.warning("Gemini rate limit exhausted: %s", e)
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE) from e
        logger.error(f"Gemini client error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Redaction failed: {str(e)}") from e
    except Exception as e:
        logger.error(f"Redaction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Redaction failed: {str(e)}") from e
    finally:
        if temp_input and Path(temp_input).exists():
            with contextlib.suppress(Exception):
                Path(temp_input).unlink()
        if temp_output and Path(temp_output).exists():
            with contextlib.suppress(Exception):
                Path(temp_output).unlink()
