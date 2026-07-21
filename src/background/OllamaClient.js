/**
 * @file OllamaClient.js
 * @description Encapsulates all communication with the local Ollama API.
 * Handles streaming, health checks, model validation, and error mapping.
 * Uses dependency injection for the base URL — testable and configurable.
 */

import { OLLAMA, ERRORS } from '../shared/constants.js';
import { withTimeout } from '../shared/utils.js';

export class OllamaClient {
  constructor(baseUrl = OLLAMA.BASE_URL, options = {}) {
    this.baseUrl = baseUrl;
    this.provider = options.provider || 'ollama';
    this.model = options.model || OLLAMA.MODELS.CHAT;
    this.embedModel = options.embedModel || OLLAMA.MODELS.EMBED;
    this._abortController = null;
  }

  setConfig(config = {}) {
    if (config.baseUrl) this.baseUrl = config.baseUrl;
    if (config.provider) this.provider = config.provider;
    if (config.model) this.model = config.model;
    if (config.embedModel) this.embedModel = config.embedModel;
  }

  async healthCheck() {
    try {
      const response = await withTimeout(
        fetch(`${this.baseUrl}${OLLAMA.ENDPOINTS.TAGS}`),
        5000,
        'Ollama health check timed out'
      );
      if (!response.ok) return { online: false, hasModel: false, error: ERRORS.OLLAMA_NOT_RUNNING };
      const data = await response.json();
      const available = (data.models || []).map((m) => m.name);
      const hasModel = available.some((n) => n.startsWith(OLLAMA.MODELS.CHAT.split(':')[0]));
      return { online: true, hasModel, availableModels: available, error: hasModel ? null : ERRORS.OLLAMA_MODEL_MISSING };
    } catch {
      return { online: false, hasModel: false, error: ERRORS.OLLAMA_NOT_RUNNING };
    }
  }

  async chat({ messages, model, onChunk, onDone, onError }) {
    this._abortController = new AbortController();
    const body = {
      model: model || this.model,
      messages,
      stream: true,
      options: { temperature: OLLAMA.PARAMS.TEMPERATURE, num_predict: OLLAMA.PARAMS.MAX_TOKENS, top_p: OLLAMA.PARAMS.TOP_P },
    };
    try {
      const response = await fetch(`${this.baseUrl}${OLLAMA.ENDPOINTS.CHAT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this._abortController.signal,
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Ollama API error ${response.status}: ${err}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '', buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const p = JSON.parse(line);
            const token = p?.message?.content || '';
            if (token) { fullText += token; onChunk(token); }
            if (p.done) { onDone(fullText); return; }
          } catch { /* skip malformed */ }
        }
      }
      onDone(fullText);
    } catch (error) {
      if (error.name === 'AbortError') return;
      onError(this._mapError(error));
    } finally {
      this._abortController = null;
    }
  }

  abort() {
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
  }

  async embed(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('embed: text must be a non-empty string');
    const response = await withTimeout(
      fetch(`${this.baseUrl}${OLLAMA.ENDPOINTS.EMBEDDINGS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.embedModel, prompt: text.trim() }),
      }),
      OLLAMA.TIMEOUT_MS,
      ERRORS.OLLAMA_TIMEOUT
    );
    if (!response.ok) throw new Error(`Embed failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.embedding)) throw new Error('Unexpected embedding format');
    return data.embedding;
  }

  async generate(prompt, modelOrOptions = null) {
    const options = typeof modelOrOptions === 'object' && modelOrOptions !== null && !Array.isArray(modelOrOptions)
      ? modelOrOptions
      : null;
    const model = options?.model || (typeof modelOrOptions === 'string' ? modelOrOptions : OLLAMA.MODELS.CHAT);
    const response = await withTimeout(
      fetch(`${this.baseUrl}${OLLAMA.ENDPOINTS.GENERATE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || this.model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.1,
            num_predict: options?.num_predict ?? 512,
            top_p: options?.top_p ?? 0.9,
          },
        }),
      }),
      OLLAMA.TIMEOUT_MS,
      ERRORS.OLLAMA_TIMEOUT
    );
    if (!response.ok) throw new Error(`Generate failed: ${response.status}`);
    const data = await response.json();
    return data.response || '';
  }

  _mapError(error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
      return new Error(ERRORS.OLLAMA_NOT_RUNNING);
    }
    if (error.message.includes('timed out')) return new Error(ERRORS.OLLAMA_TIMEOUT);
    return error;
  }
}
