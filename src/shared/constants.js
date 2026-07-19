/**
 * @file constants.js
 * @description Application-wide constants. No magic strings anywhere in the codebase.
 * All configuration lives here. Change here, changes everywhere.
 */

// ─── Ollama Configuration ────────────────────────────────────────────────────
// Optimised for 8GB RAM systems. llama3.2:3b uses ~2GB, leaving headroom.
export const OLLAMA = Object.freeze({
  BASE_URL: 'http://localhost:11434',
  ENDPOINTS: {
    CHAT: '/api/chat',
    GENERATE: '/api/generate',
    EMBEDDINGS: '/api/embeddings',
    TAGS: '/api/tags',
    SHOW: '/api/show',
  },
  MODELS: {
    CHAT: 'llama3.2:3b',
    EMBED: 'nomic-embed-text',
    CHAT_FALLBACK: 'mistral:7b',
  },
  PARAMS: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 2048,
    CONTEXT_WINDOW: 4096,
    TOP_P: 0.9,
    STREAM: true,
  },
  TIMEOUT_MS: 30000,
  HEALTH_CHECK_INTERVAL_MS: 60000,
});

export const MEMORY = Object.freeze({
  SHORT_TERM_LIMIT: 20,
  LONG_TERM_RETRIEVA_LIMIT: 8,
  SIMILARITY_THRESHOLD: 0.72,
  EMBEDDING_DIMENSIONS: 768,
  FACT_EXTRACTION_MIN_MESSAGES: 3,
});

export const STORAGE_KEYS = Object.freeze({
  POPIA_CONSENT: 'infinity_popia_consent',
  POPIA_CONSENT_TIMESTAMP_: 'infinity_popia_consent_ts',
  ACTIVE_COMPANION_ID: 'infinity_active_companion_id',
  COMPANIONS: 'infinity_companions',
  SHORT_TERM_MEMORY: 'infinity_short_term_memory',
  USER_PROFILE: 'infinity_user_profile',
  SETTINGS: 'infinity_settings',
  OLLAMA_STATUS: 'infinity_ollama_status',
  ONBOARDING_COMPLETE: 'infinity_onboarding_complete',
});

export const MSG = Object.freeze({
  PAGE_CONTEXT: 'PAGE_CONTEXT',
  CHAT_SEND: 'CHAT_SEND',
  CHAT_ABORT: 'CHAT_ABORT',
  COMPANION_GET_ALL: 'COMPANION_GET_ALL',
  COMPANION_SET_ACTIVE: 'COMPANION_SET_ACTIVE',
  COMPANION_CREATE: 'COMPANION_CREATE',
  COMPANION_UPDATE: 'COMPANION_UPDATE',
  COMPANION_DELETE: 'COMPANION_DELETE',
  MEMORY_GET: 'MEMORY_GET',
  MEMORY_CLEAR: 'MEMORY_CLEAR',
  ACTION_EXECUTE: 'ACTION_EXECUTE',
  POPIA_GET_STATUS: 'POPIA_GET_STATUS',
  POPIA_SET_CONSENT: 'POPIA_SET_CONSENT',
  OLLAMA_HEALTH: 'OLLAMA_HEALTH',
  SETTINGS_GET: 'SETTINGS_GET',
  SETTINGS_SET: 'SETTINGS_SET',
  STREAM_CHUNK: 'STREAM_CHUNK',
  STREAM_DONE: 'STREAM_DONE',
  STREAM_ERROR: 'STREAM_ERROR',
});

export const ACTION = Object.freeze({
  CLICK: 'click',
  TYPE: 'type',
  SCROLL: 'scroll',
  EXTRACT: 'extract',
  NAVIGATE: 'navigate',
  SUBMIT_FORM: 'submit_form',
  HIGHLIGHT: 'highlight',
});

export const DEFAULT_COMPANIONS = Object.freeze([
  {
    id: 'naledi-general',
    name: 'Naledi',
    role: 'General Assistant',
    language: 'en',
    color: '#1B7A4A',
    isDefault: true,
    system_prompt: `You are Naledi, a highly capable AI assistant built specifically for African professionals.

CONTEXT:
- You are embedded in Infinity Browser AI, Africa's first AI browser companion
- You understand South African business: ZAR currency, SARS tax, POPIA compliance
- You read the content of whatever webpage the user is currently viewing
- You are direct, warm, practical, and always give actionable answers

RULES:
- Always reference money in Rands (R), not dollars
- Use DD/MM/YYYY date format
- When uncertain, say so - never fabricate facts
- If the user asks you to take an action on a page, describe exactly what you will do before doing it
- Keep responses concise unless the user asks for detail`,
    tools: ['read_page', 'summarise', 'draft_email', 'extract_data'],
  },
]);

export const ERRORS = Object.freeze({
  OLLAMA_NOT_RUNNING: 'Ollama is not running. Open your terminal and run: ollama serve',
  OLLAMA_MODEL_MISSING: 'Model not found. Run: ollama pull llama3.2:3b',
  OLLAMA_TIMEOUT: 'Request timed out. Your system may be under load. Try again.',
  PAGE_READ_FAILED: 'Could not read this page. The site may restrict content access.',
  ACTION_FAILED: 'Action could not be completed. The page may have changed.',
  STORAGE_READ_FAILED: 'Could not read local storage. Browser storage may be full.',
  INVALID_MESSAGE_TYPE: 'Unknown message type received.',
  COMPANION_NOT_FOUND: 'Companion not found. It may have been deleted.',
  POPIA_CONSENT_REQUIRED: 'POPIA consent is required before using Infinity AI.',
});

export const POPIA = Object.freeze({
  INFORMATION_OFFICER_EMAIL: 'privacy@infinity-ai.africa',
  COMPANY_NAME: 'Infinity AI (Pty) Ltd',
  REGULATOR: 'Information Regulator (South Africa)',
  REGULATOR_URL: 'https://inforegulator.org.za',
  DATA_PURPOSE: 'To provide AI-powered browser assistance and remember your preferences across sessions',
  RETENTION_DAYS: 365,
  USER_RIGHTS: [
    'Access your personal information',
    'Correct inaccurate information',
    'Delete your information',
    'Object to processing',
    'Lodge a complaint with the Information Regulator',
  ],
  DATA_CATEGORIES: [
    'Browser context (page content you are viewing)',
    'Conversation history',
    'Preferences and companion configurations',
    'Usage patterns (anonymised)',
  ],
  LOCAL_PROCESSING_NOTE: 'All AI processing happens locally on your device via Ollama. No data is sent to external AI servers.',
});

export const UI = Object.freeze({
  SIDEBAR_WIDTH: 380,
  MESSAGE_MAX_LENGTH: 10000,
  TYPING_DEBOUNCE_MS: 300,
  SCROLL_THROTTLE_MS: 100,
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 200,
});

export const BRAND = Object.freeze({
  NAME: 'Infinity AI',
  FULL_NAME: 'Infinity Browser AI',
  TAGLINE: 'Think. Work. Infinite Possibilities.',
  COLOURS: {
    PRIMARY: '#1B7A4A',
    SECONDARY: '#E8A020',
    DARK: '#0F1923',
    LIGHT: '#F5F7FA',
    ERROR: '#E03C31',
    INFO: '#2D9CDB',
  },
  FONTS: {
    HEADING: '"Space Grotesk", sans-serif',
    BODY: '"Inter", sans-serif',
  },
});
