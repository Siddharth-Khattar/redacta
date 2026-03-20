<div align="center">

<img src="frontend/public/brand/icon-dark.svg" alt="Redacta" width="80" />

# Redacta

**AI-powered PDF redaction that runs entirely in your browser.**

Describe what to redact in plain language. Gemini identifies it. MuPDF removes it.
Your documents never leave your device.

[![License: MIT](https://img.shields.io/badge/License-MIT-e2dfd8?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-58c4dc?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Gemini API](https://img.shields.io/badge/Gemini-API-4285f4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)

[Live App](https://redacta.khattar.dev) · [Report Bug](https://github.com/Siddharth-Khattar/redacta/issues)

<br />

<a href="https://ko-fi.com/siddharthkhattar"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" height="32" /></a>

</div>

---

## How It Works

```mermaid
flowchart LR
    A["Upload PDF"] --> B["Describe what\nto redact"]
    B --> C["Gemini identifies\ntargets"]
    C --> D["MuPDF applies\nredactions"]
    D --> E["Download\nredacted PDF"]

    style A fill:#1c1c20,stroke:#d9534f,color:#e2dfd8
    style B fill:#1c1c20,stroke:#d9534f,color:#e2dfd8
    style C fill:#1c1c20,stroke:#d9534f,color:#e2dfd8
    style D fill:#1c1c20,stroke:#d9534f,color:#e2dfd8
    style E fill:#d9534f,stroke:#d9534f,color:#fff
```

1. **Upload** a PDF via drag-and-drop or file picker
2. **Describe** what to redact in plain language (e.g. *"all personal names and phone numbers"*)
3. **Gemini** analyzes every page and identifies exact text matches
4. **MuPDF** applies black-box redactions: visual overlays or permanent text destruction
5. **Download** the redacted document

Everything happens client-side. The PDF is processed by MuPDF compiled to WebAssembly, and Gemini is called directly from your browser using your own API key. No backend. No server. No data leaves your machine.

---

## Features

- **Natural language redaction** : describe what to censor, not where it is
- **Visual or permanent** : black-box overlays (reversible) or full text destruction (irreversible)
- **Three Gemini models** : 2.0 Flash (fast), 3.0 Flash (balanced), 3.1 Pro (most capable)
- **Configurable thinking depth** : minimal to high reasoning for complex documents
- **Live cost estimation** : token counts and USD cost displayed after each run
- **Split-pane workspace** : original and redacted PDFs side by side, resizable
- **Dark & light themes** : respects system preference, toggleable
- **Fully private** : your API key stays in localStorage, documents stay in memory

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)
- A free [Gemini API key](https://aistudio.google.com/apikey)

### Run locally

```bash
# Install dependencies
make setup

# Start dev server
make dev
```

Open [http://localhost:5173](http://localhost:5173). Enter your API key when prompted.

### Production build

```bash
make build          # Build to frontend/dist
make preview        # Build + serve locally
```

---

## Architecture

```mermaid
graph TD
    subgraph Browser["Browser (client-side only)"]
        UI["React 19 + Vite 6"]
        subgraph Engine
            PDF["MuPDF WASM\nText extraction + redaction"]
            GEM["@google/genai SDK\nStreaming + retry"]
            PRC["Pricing module\nOpenRouter + fallback"]
        end
        UI --> Engine
    end

    GEM -->|"HTTPS"| GEMAPI["Gemini API"]
    PRC -->|"HTTPS"| ORAPI["OpenRouter API"]
    Browser -->|"Static files"| CF["Cloudflare Workers"]

    style Browser fill:#1c1c20,stroke:#30303a,color:#e2dfd8
    style Engine fill:#222228,stroke:#30303a,color:#e2dfd8
    style UI fill:#222228,stroke:#30303a,color:#e2dfd8
    style PDF fill:#222228,stroke:#d9534f,color:#e2dfd8
    style GEM fill:#222228,stroke:#4285f4,color:#e2dfd8
    style PRC fill:#222228,stroke:#30303a,color:#e2dfd8
    style GEMAPI fill:#4285f4,stroke:#4285f4,color:#fff
    style ORAPI fill:#30303a,stroke:#30303a,color:#e2dfd8
    style CF fill:#f38020,stroke:#f38020,color:#fff
```

The entire application compiles to static files. Cloudflare Workers serves them with proper WASM headers and SPA routing. There is no server-side code.

---

## Supported Models

| Model | Thinking Levels | Best For |
|---|---|---|
| Gemini 2.0 Flash | None | Fast, cost-effective redaction |
| Gemini 3.0 Flash | Minimal · Low · Medium · High | Balanced speed and accuracy |
| Gemini 3.1 Pro | Low · Medium · High | Complex documents, highest accuracy |

<details>
<summary><strong>Pricing (per million tokens)</strong></summary>

| Model | Input | Output | Thinking |
|---|---|---|---|
| 2.0 Flash | $0.10 | $0.40 | N/A |
| 3.0 Flash | $0.50 | $3.00 | $3.00 |
| 3.1 Pro | $2.00 | $12.00 | $12.00 |

Prices fetched live from [OpenRouter](https://openrouter.ai) with a 6-hour cache. Falls back to hardcoded defaults if unavailable.

</details>

---

## Privacy & Security

| Concern | How it's handled |
|---|---|
| **PDF content** | Processed in-browser via WASM. Never uploaded anywhere. |
| **API key** | Stored in `localStorage`. Sent only to `generativelanguage.googleapis.com`. |
| **Redacted output** | Exists only in browser memory until downloaded. |
| **Analytics / tracking** | None. Zero telemetry. |
| **CSP** | Strict Content-Security-Policy headers. Only allows Gemini API and OpenRouter. |

---

## Development

### Commands

| Command | Description |
|---|---|
| `make setup` | Install dependencies |
| `make dev` | Dev server with hot reload |
| `make build` | TypeScript check + production build |
| `make preview` | Build + preview production bundle |
| `make format` | Auto-format with Biome |
| `make lint` | TypeScript + Biome checks |
| `make check` | Format + lint (full quality gate) |
| `make clean` | Remove `node_modules` and `dist` |

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build | Vite 6 |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 4 |
| Animation | Motion (Framer Motion) |
| PDF Engine | MuPDF 1.27 (WASM) |
| AI | Google GenAI SDK |
| Icons | Lucide React |
| Lint / Format | Biome |
| Hosting | Cloudflare Workers |

### Project Structure

```
frontend/
├── public/
│   ├── brand/                 Icon + lockup SVGs (dark, light, transparent)
│   ├── favicon.svg            Browser tab icon
│   └── _headers               Cloudflare caching + security headers
├── src/
│   ├── engine/
│   │   ├── types.ts           Shared types + RedactionEngineError
│   │   ├── pdf.ts             MuPDF WASM: extract text, apply redactions
│   │   ├── gemini.ts          Gemini streaming client + retry logic
│   │   ├── pricing.ts         OpenRouter pricing fetch + cache
│   │   └── orchestrator.ts    Pipeline: extract > identify > redact > cost
│   ├── hooks/
│   │   └── useApiKey.ts       localStorage-backed API key hook
│   ├── api/
│   │   └── redaction.ts       Adapter: engine to UI contract (snake_case)
│   ├── components/            React UI components
│   ├── App.tsx                Root state machine
│   ├── index.css              Tailwind theme (dark + light)
│   └── main.tsx               Entry point
├── index.html
├── vite.config.ts
└── package.json
wrangler.jsonc                 Cloudflare Workers deployment config
Makefile                       Dev workflow commands
```

---

## Deployment

Redacta deploys as a static site on Cloudflare Workers. Push to `main` triggers automatic deployment.

```mermaid
flowchart LR
    A["git push main"] --> B["Cloudflare Build"]
    B --> C["bun install\n+ bun run build"]
    C --> D["wrangler deploy"]
    D --> E["redacta.khattar.dev"]

    style A fill:#1c1c20,stroke:#30303a,color:#e2dfd8
    style B fill:#f38020,stroke:#f38020,color:#fff
    style C fill:#1c1c20,stroke:#30303a,color:#e2dfd8
    style D fill:#f38020,stroke:#f38020,color:#fff
    style E fill:#d9534f,stroke:#d9534f,color:#fff
```

### Cloudflare build settings

| Setting | Value |
|---|---|
| Build command | `cd frontend && bun install && bun run build` |
| Deploy command | `npx wrangler deploy` |

---

## License

[MIT](LICENSE) · Siddharth Khattar, 2026
