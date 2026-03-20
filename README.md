# Redacta

AI-powered PDF redaction tool. Upload a PDF, describe what to redact in plain language, and download the redacted document.

## Prerequisites

- Python 3.11+
- Node.js 18+ or Bun
- A [Google Gemini API key](https://aistudio.google.com/apikey)

## Quick Start

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and set your GOOGLE_API_KEY

# 2. Install dependencies
make setup

# 3. Run both servers
make dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_API_KEY` | Yes | - | Your Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model to use |
| `RATE_LIMIT_RETRY_ATTEMPTS` | No | `4` | Max retries on 429 |
| `RATE_LIMIT_INITIAL_WAIT` | No | `30` | Initial retry wait (seconds) |
| `RATE_LIMIT_MAX_WAIT` | No | `120` | Max retry wait (seconds) |

## How It Works

1. **Upload** a PDF file via drag-and-drop or file picker
2. **Describe** what to redact (e.g., "all personal names and phone numbers")
3. **Gemini** analyzes the document text and identifies matching content
4. **PyMuPDF** applies black box overlays (or permanent removal) to the PDF
5. **Download** the redacted document

## Architecture

```
Frontend (Vite + React)  →  /api proxy  →  Backend (FastAPI)
                                              ↓
                                        Gemini API (identify targets)
                                              ↓
                                        PyMuPDF (apply redactions)
```
