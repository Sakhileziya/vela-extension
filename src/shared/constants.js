/**
 * @file constants.js
 * @description Application-wide constants. No magic strings anywhere in the codebase.
 */

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
  LONG_TERM_RETRIEVAL_LIMIT: 8,
  SIMILARITY_THRESHOLD: 0.72,
  EMBEDDING_DIMENSIONS: 768,
  FACT_EXTRACTION_MIN_MESSAGES: 3,
});

export const STORAGE_KEYS = Object.freeze({
  POPIA_CONSENT: 'vela_popia_consent',
  POPIA_CONSENT_TIMESTAMP: 'vela_popia_consent_ts',
  ACTIVE_COMPANION_ID: 'vela_active_companion_id',
  COMPANIONS: 'vela_companions',
  SHORT_TERM_MEMORY: 'vela_short_term_memory',
  USER_PROFILE: 'vela_user_profile',
  SETTINGS: 'vela_settings',
  OLLAMA_STATUS: 'vela_ollama_status',
  ONBOARDING_COMPLETE: 'vela_onboarding_complete',
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
    system_prompt: `You are Naledi, a highly capable AI assistant built for African professionals. You are embedded in Vela, Africa's first AI browser companion. Always reference money in Rands (R). Use DD/MM/YYYY date format. Never fabricate facts.`,
    tools: ['read_page', 'summarise', 'draft_email', 'extract_data'],
  },
  {
    id: 'kolo-finance',
    name: 'Kholo',
    role: 'Financial Analysis Assistant',
    language: 'en',
    color: '#E8A020',
    isDefault: true,
    system_prompt: `You are Kholo, a financial assistant for South African businesses. Always use Rands (R) and SA financial conventions.`,
    tools: ['read_page', 'extract_data', 'calculate', 'summarise'],
  },
]);

export const ERRORS = Object.freeze({
  OLLAMA_NOT_RUNNING: 'Ollama is not running. Open your terminal and run: ollama serve',
  OLLAMA_MODEL_MISSING: 'Model not found. Run: ollama pull llama3.2:3b',
  OLLAMA_TIMEOUT: 'Request timed out. Try again.',
  PAGE_READ_FAILED: 'Could not read this page.',
  ACTION_FAILED: 'Action could not be completed.',
  STORAGE_READ_FAILED: 'Could not read local storage.',
  COMPANION_NOT_FOUND: 'Companion not found.',
  POPIA_CONSENT_REQUIRED: 'POPIA consent is required before using Vela.',
});

export const BRAND = Object.freeze({
  NAME: 'Vela',
  TAGLINE: 'Think. Work. Africa First.',
  COLOURS: { PRIMARY: '#1B7A4A', SECONDARY: '#E8A020', DARK: '#0F1923', LIGHT: '#F5F7FA', ERROR: '#E03C31' },
  FONTS: { HEADING: '"Space Grotesk", sans-serif', BODY: '"Inter", sans-serif' },
});

export const UI = Object.freeze({
  SIDEBAR_WIDTH: 380,
  MESSAGE_MAX_LENGTH: 10000,
  TYPING_DEBOUNCE_MS: 300,
  SCROLL_THROTTLE_MS: 100,
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 200,
});
