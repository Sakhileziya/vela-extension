# Infinity Browser AI — Africa's First AI Browser Companion

> Think. Work. Africa First.

Infinity Browser AI is a Chrome extension that adds a persistent, memory-enabled AI companion to your browser. It reads any webpage you are on, executes browser actions on your behalf, and learns your preferences over time — all running locally via Ollama. No data leaves your device.

**Status:** Launch-ready backend foundation  
**Stack:** Chrome Extension (MV3) + React + Node.js server + Ollama-compatible LLM proxy + append-only event storage  
**Cost to run:** R0 during development. ~R2,000–5,000/month for a production server.

## What is now included

- A hardened Node server with health checks, metrics, auth, rate limiting, and CORS
- OpenAI-compatible endpoints for chat, embeddings, and model discovery
- Durable append-only event logging for analytics and monitoring
- Tests for auth and storage behaviors
- Docker support for local/container deployment

## Run the backend

```bash
npm install
npm run start:server
```

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Send an event with the default dev key:

```bash
curl -X POST http://localhost:3000/v1/events \
  -H "x-api-key: dev-change-me" \
  -H "Content-Type: application/json" \
  -d '{"type":"signup","payload":{"user":"alice"}}'
```

Run tests:

```bash
npm run test
```

## Architecture Overview

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           CHROME EXTENSION (Manifest V3)            │
│                                                     │
│  ┌────────────��┐    ┌──────────────────────────┐   │
│  │  Sidebar UI  │    │   Content Script          │   │
│  │  (React)     │    │   (page reader)           │   │
│  └──────┬─────┘    └────────────┬──────────────┘  │
│         └──────────┬─────────────┘                  │
│                    ▼                                 │
│         ┌────────────────────┐                     │
│         │  Service Worker      │                     │
│         │  (background/index)  │                     │
│         └────────┬────────────┘                     │
└──────────────────┼──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
 Ollama (local)          Chrome Storage
 localhost:11434          (memories, companions,
 llama3.2:3b              conversations, settings)
 nomic-embed-text
```

**Principle:** The sidebar and content script never call services directly. Everything routes through the background service worker via typed messages. This is the only architecture that works correctly with Manifest V3.

---

## Directory Structure

```
vela-extension/
├── manifest.json                  ← Extension config (Manifest V3)
├── package.json                   ← Dependencies and scripts
├── vite.config.js                 ← Build configuration
├── .env.example                   ← Environment variable template
├── .gitignore
├── README.md
│
├── src/
│   ├── background/
│   │   ├── index.js               ← Service worker (message router + orchestrator)
│   │   ├── OllamaClient.js        ← Ollama API — streaming, embeddings, health
│   │   ├── MemoryManager.js       ← Short-term + long-term memory
│   │   ├── ActionExecutor.js      + browser automation (click, type, scroll, extract)
│   │   └── CompanionManager.js    ← Companion CRUD + system prompt builder
│   │
│   ├── content/
│   │   └── index.js               ← Page context extractor (DOM reader)
│   │
│   ├── sidebar/
│   │   ├── index.html             ← Sidebar HTML shell
│   │   ├── main.jsx               ← React entry point
│   │   ├── App.jsx                ← Root component
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Sakhileziya/vela-extension.git
cd vela-extension

# Install dependencies
npm install

# Build
npm run build

# Load in Chrome at chrome://extensions > Load unpacked > select /dist
```

---

Proprietary | Infinity AI (Pty) Ltd | Built in South Africa
