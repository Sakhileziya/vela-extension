# Free pilot setup

## What this gives you
- A working browser-extension product for your first 20 users
- A free, local-first telemetry store for usage events
- A backend that can use Groq, Together, OpenAI-compatible APIs, or local Ollama

## Run the backend
```bash
npm run start:server
```

## Recommended free provider
Use Groq or Together AI for the first pilot. They provide strong performance and a friendly free tier.

## Environment variables
See [.env.example](../.env.example) for the full list.

Minimum example:
```bash
AI_PROVIDER=groq
GROQ_API_KEY=your-key-here
GROQ_MODEL=llama-3.3-70b-versatile
```

## How to use it with the extension
- Build the extension: `npm run build`
- Load `dist` in Chrome
- Open the Settings tab and set:
  - Provider Mode: `Cloud / Hosted Proxy`
  - Backend URL: `http://localhost:3000` or your deployed host

## Data collection
The backend stores anonymized pilot events in `data/pilot-events.jsonl`.
