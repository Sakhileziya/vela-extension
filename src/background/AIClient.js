/**
 * @file AIClient.js
 * @description Strategy Pattern AI client. Supports three providers:
 *   - Ollama (local, zero-cost, POPIA compliant)
 *   - Groq (remote, free tier: 14,400 req/day with llama-3.3-70b)
 *   - Gemini (remote, free tier: 1,500 req/day with gemini-1.5-flash)
 *
 * Usage: the background router selects the provider based on user settings
 * and Ollama health check. Ollama is always preferred (data residency).
 */

import { OLLAMA } from '../shared/constants.js';
import { withTimeout, withRetry } from '../shared/utils.js';

// ──── PROVIDER CONSTANTS ───────────────────────────────────────────────

export const REMOTE_PROVIDERS = Object.freeze({
  GROQ: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    maxTokens: 2048,
    freeTierLimit: '14,400 req/day',
  },
  GEMINI: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-1.5-flash',
    maxTokens: 2048,
    freeTierLimit: '1,500 req/day',
  },
});

// ─── OLLAMA CLIENT ────────────────────────────────────────────────────────

/**
 * Sends a chat message through Ollama (8GB RAM optimised).
 * Streams tokens via callback if provided.
 * @param {Array} messages - Chat messages [{role, content}]
 * @param {Function|null} onChunk - Stream callback(chunk: string)
 * @returns {Promise<string>} Full response text
 */
export async function ollamaChat(messages, onChunk = null) {
  const url = `${OLLAMA.BASE_URL}${OLLAMA.ENDPOINTS.CHAT}`;
  const requestBody = {
    model: OLLAMA.MODELS.CHAT,
    messages,
    stream: !!onChunk,
    options: {
      temperature: OLLAMA.PARAMS.TEMPERATURE,
      num_predict: OLLAMA.PARAMS.MAX_TOKENS,
    },
  };

  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }),
    OLLAMA.TIMEOUT_MS,
    'Ollama request timed out'
  );

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  }

  if (!onChunk) {
    const data = await response.json();
    return data.message?.content || '';
  }

  // Streaming mode
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const line = decoder.decode(value, { stream: true });
    try {
      const parsed = JSON.parse(line.trim());
      const token = parsed.message?.content || '';
      if (token) {
        fullText += token;
        onChunk(token);
      }
    } catch { /* partial line - ignore */ }
  }

  return fullText;
}

/**
 * Generates embeddings via Ollama (nomic-embed-text).
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector (768 dimensions)
 */
export async function ollamaEmbed(text) {
  const response = await withTimeout(
    fetch(`${OLLAMA.BASE_URL}${OLLAMA.ENDPOINTS.EMBEDDIGNS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA.MODELS.EMBED, prompt: text }),
    }),
    15000,
    'Ollama embedding timed out'
  );
  if (!response.ok) throw new Error(`Embedding error: ${response.status}`);
  const data = await response.json();
  return data.embedding;
}

/**
 * Checks if Ollama is running and has the required models.
 * @returns {Promise<{online, hasModel, models}>}
 */
export async function checkOllamaHealth() {
  try {
    const response = await withTimeout(
      fetch(`${OLLAMA.BASE_URL}${OLLAMA.ENDPOINTS.TAGS}`),
      5000,
      'Ollama health check timed out'
    );
    if (!response.ok) return { online: false, hasModel: false, models: [] };
    const data = await response.json();
    const modelNames = (data.models || []).map((m) => m.name);
    const hasModel = modelNames.some((n) => n.includes('llama3.2:3b'));
    return { online: true, hasModel, models: modelNames };
  } catch {
    return { online: false, hasModel: false, models: [] };
  }
}

// ─── GROQ CLIENT ────────────────────────────────────────────────────────

/**
 * Sends a message via Groq API (OpenAI-compatible).
 * @param {Array} messages - Chat messages
 * @param {string} apiKey - Groq API key
 * @param {Function|null} onChunk - Stream callback
 * @returns {Promise<string>}
 */
export async function groqChat(messages, apiKey, onChunk = null) {
  const response = await withTimeout(
    fetch(REMOTE_PROVIDERQ.GROQ.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: REMOTE_PROVIDERS.GROQ.defaultModel,
        messages,
        max_tokens: REMOTE_PROVIDERS.GROQ.maxTokens,
        stream: !!onChunk,
      }),
    }),
    30000,
    'Groq request timed out'
  );

  if (!response.ok) {
    throw new Error(`Groq error ${response.status}: ${await response.text()}`);
  }

  if (!onChunk) {
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  // SSE streaming
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') break;
      try {
        const token = JSON.parse(payload).choices[0]?.delta?.content || '';
        if (token) { fullText += token; onChunk(token); }
      } catch { /* partial line */ }
    }
  }
  return fullText;
}

// ─── GEMINI CLIENT ──────────────────────────────────────────────────────

/**
 * Sends a message via Google Gemini API.
 * @param {Array} messages - Chat messages [{role, content}]
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<string>}
 */
export async function geminiChat(messages, apiKey) {
  const model = REMOTE_PROVIDERS.GEMINI.defaultModel;
  const url = `${REMOTE_PROVIDERS.GEMINI.baseUrl}/${model}:generateContent?key=${apiKey}`;

  // Convert OpenAI message format to Gemini format
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const requestBody = {
    contents: conversation,
    generationConfig: { maxOutputTokens: REMOTE_PROVIDERS.GEMINI.maxTokens },
  };

  if (systemMsg) {
    requestBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }),
    30000,
    'Gemini request timed out'
  );

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}
