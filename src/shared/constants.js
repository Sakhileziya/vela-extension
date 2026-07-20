/**
 * @file constants.js
 * @description Application-wide constants. No magic strings anywhere in the codebase.
 * All configuration lives here. Change here, changes everywhere.
 */

// ─── Ollama Configuration ───────────────────────────────────────────────────
// Optimised for 8GB RAM systems. llama3.2:3b uses ~2GB, leaving headroom.
export const OLLAMA = Object.freeze({
  BASE_URL: 'http://localhost:11434',
  ENDPOINTS: {
    CHAT: '/api/chat',
    GENERATE: '/api/generate',
    EMBEDDINGS: '/api/embeddings',
    TAGS: '/api/tags',         // Lists available models
    SHOW: '/api/show',
  },
  MODELS: {
    CHAT: 'llama3.2:3b',          // Primary chat model (2GB RAM)
    EMBED: 'nomic-embed-text',     // Embedding model (274MB RAM)
    CHAT_FALLBACK: 'mistral:7b',   // Fallback if llama3.2 not available
  },
  PARAMS: {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 2048,
    CONTEXT_WINDOW: 4096,
    TOP_P: 0.9,
    STREAM: true,
  },
  TIMEOUT_MS: 30000,           // 30 seconds before connection timeout
  HEALTH_CHECK_INTERVAL_MS: 60000, // Check every 60 seconds
});

// ─── Memory Configuration ────────────────────────────────────────────────────
export const MEMORY = Object.freeze({
  SHORT_TERM_LIMIT: 20,           // Max messages kept in Chrome local storage
  LONG_TERM_RETRIEVAL_LIMIT: 8,   // Top N memories injected per session
  SIMILARITY_THRESHOLD: 0.72,     // Min cosine similarity for memory retrieval
  EMBEDDING_DIMENSIONS: 768,      // nomic-embed-text output dimensions
  FACT_EXTRACTION_MIN_MESSAGES: 3, // Only extract facts after N messages
});

// ─── Chrome Storage Keys ─────────────────────────────────────────────────────
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

// ─── Extension Messaging Protocol ────────────────────────────────────────────
// All inter-component communication uses these typed message names.
export const MSG = Object.freeze({
  // content → background
  PAGE_CONTEXT: 'PAGE_CONTEXT',

  // sidebar → background
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

  // background → sidebar (streaming)
  STREAM_CHUNK: 'STREAM_CHUNK',
  STREAM_DONE: 'STREAM_DONE',
  STREAM_ERROR: 'STREAM_ERROR',

  // Research Agent (sidebar → background)
  RESEARCH_START: 'RESEARCH_START',
  RESEARCH_ABORT: 'RESEARCH_ABORT',
  // Research Agent (background → sidebar)
  RESEARCH_PROGRESS: 'RESEARCH_PROGRESS',
  RESEARCH_DONE: 'RESEARCH_DONE',
  RESEARCH_ERROR: 'RESEARCH_ERROR',

  // Computer Agent (sidebar → background)
  COMPUTER_NAVIGATE: 'COMPUTER_NAVIGATE',
  COMPUTER_CLICK: 'COMPUTER_CLICK',
  COMPUTER_TYPE: 'COMPUTER_TYPE',
  COMPUTER_EXTRACT: 'COMPUTER_EXTRACT',
  COMPUTER_SCREENSHOT: 'COMPUTER_SCREENSHOT',
  COMPUTER_SCROLL: 'COMPUTER_SCROLL',

  // Workflow Engine (sidebar → background)
  WORKFLOW_LIST: 'WORKFLOW_LIST',
  WORKFLOW_SAVE: 'WORKFLOW_SAVE',
  WORKFLOW_DELETE: 'WORKFLOW_DELETE',
  WORKFLOW_RUN: 'WORKFLOW_RUN',
  WORKFLOW_ABORT: 'WORKFLOW_ABORT',
  // Workflow Engine (background → sidebar)
  WORKFLOW_PROGRESS: 'WORKFLOW_PROGRESS',
  WORKFLOW_DONE: 'WORKFLOW_DONE',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
});

// ─── Browser Action Types ─────────────────────────────────────────────────────
export const ACTION = Object.freeze({
  CLICK: 'click',
  TYPE: 'type',
  SCROLL: 'scroll',
  EXTRACT: 'extract',
  NAVIGATE: 'navigate',
  SUBMIT_FORM: 'submit_form',
  HIGHLIGHT: 'highlight',
});

// ─── Default Companions ───────────────────────────────────────────────────────
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
- You understand South African business: ZAR currency, SARS tax, POPIA compliance, Companies Act, NCA
- You read the content of whatever webpage the user is currently viewing
- You are direct, warm, practical, and always give actionable answers

RULES:
- Always reference money in Rands (R), not dollars
- Use DD/MM/YYYY date format
- When uncertain, say so — never fabricate facts
- If the user asks you to take an action on a page, describe exactly what you will do before doing it
- Keep responses concise unless the user asks for detail

CAPABILITIES:
- Summarise any webpage
- Draft professional emails and documents
- Extract and analyse data from tables and forms
- Answer questions about page content
- Remember context from previous conversations`,
    tools: ['read_page', 'summarise', 'draft_email', 'extract_data'],
  },
  {
    id: 'advocate-legal',
    name: 'Advocate',
    role: 'Legal Research Assistant',
    language: 'en',
    color: '#1A237E',
    isDefault: true,
    system_prompt: `You are a legal research assistant specialised in South African law.

EXPERTISE:
- Constitution of the Republic of South Africa, 1996
- Companies Act 71 of 2008
- Labour Relations Act 66 of 1995
- Basic Conditions of Employment Act
- POPIA (Protection of Personal Information Act 4 of 2013)
- Consumer Protection Act 68 of 2008
- National Credit Act 34 of 2005
- General contract law and common law principles

RULES:
- Clearly state: "This is legal research assistance, not formal legal advice"
- Cite legislation and case law accurately when referenced
- If you are unsure of a legal position, say so explicitly
- Use precise legal terminology
- Summarise complex legal language into plain English when asked`,
    tools: ['read_page', 'summarise', 'extract_data', 'draft_document'],
  },
  {
    id: 'kholo-finance',
    name: 'Kholo',
    role: 'Financial Analysis Assistant',
    language: 'en',
    color: '#E8A020',
    isDefault: true,
    system_prompt: `You are Kholo, a financial analysis assistant for South African businesses.

EXPERTISE:
- SARS tax: VAT (15%), PAYE, corporate income tax, provisional tax
- IFRS financial statements
- South African business finance and working capital
- JSE-listed company analysis
- SME financial management
- Budgeting, forecasting, cash flow analysis

RULES:
- Always use Rands (R) and South African financial conventions
- Reference current South African tax rates when known
- Flag when financial information may be outdated
- Be precise with numbers — errors in finance are costly
- Clearly distinguish between accounting treatment and tax treatment`,
    tools: ['read_page', 'extract_data', 'calculate', 'summarise'],
  },
]);

// ─── Error Messages ───────────────────────────────────────────────────────────
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

// ─── POPIA Compliance ─────────────────────────────────────────────────────────
export const POPIA = Object.freeze({
  INFORMATION_OFFICER_EMAIL: 'privacy@infinityai.africa',
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

// ─── UI Constants ─────────────────────────────────────────────────────────────
export const UI = Object.freeze({
  SIDEBAR_WIDTH: 380,
  MESSAGE_MAX_LENGTH: 10000,
  TYPING_DEBOUNCE_MS: 300,
  SCROLL_THROTTLE_MS: 100,
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 200,
});

// ─── Brand ────────────────────────────────────────────────────────────────────
export const BRAND = Object.freeze({
  NAME: 'Infinity AI',
  FULL_NAME: 'Infinity Browser AI',
  TAGLINE: 'Think. Work. Africa First.',
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
