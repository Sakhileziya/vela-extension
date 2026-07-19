/**
 * @file MemoryManager.js
 * @description Manages short-term and long-term memory for AI companions.
 * 
 * Two-layer architecture:
 *   1. SHORT-TERM: Last N messages, stored in Chrome local storage.
 *      Fast access, survives browser restarts, capped at MEMORY.SHORT_TERM_LIMIT.
 *   2. LONG-TERM: Extracted facts stored as vector embeddings in Chrome storage.
 *      Retrieved by semantic similarity using cosine distance.
 *      (Supabase integration is Phase 2 — local storage keeps MVP at R0 cost.)
 */

import { MEMORY, STORAGE_KEYS } from '../shared/constants.js';
import { cosineSimilarity, storageGet, storageSet, generateId } from '../shared/utils.js';

export class MemoryManager {
  /**
   * @param {import('./OllamaClient.js').OllamaClient} ollamaClient
   */
  constructor(ollamaClient) {
    if (!ollamaClient) throw new Error('MemoryManager requires an OllamaClient instance');
    this._ollama = ollamaClient;
  }

  // ─── Short-term Memory ──────────────────────────────────────────────────

  async getShortTerm(companionId) {
    const all = await storageGet(STORAGE_KEYS.SHORT_TERM_MEMORY) || {};
    return all[companionId] || [];
  }

  async appendShortTerm(companionId, message) {
    if (!companionId || !message?.role || !message?.content) {
      throw new Error('appendShortTerm: companionId and message are required');
    }
    const all = await storageGet(STORAGE_KEYS.SHORT_TERM_MEMORY) || {};
    const history = all[companionId] || [];
    history.push({ role: message.role, content: message.content, timestamp: Date.now() });
    if (history.length > MEMORY.SHORT_TERM_LIMIT) {
      history.splice(0, history.length - MEMORY.SHORT_TERM_LIMIT);
    }
    all[companionId] = history;
    await storageSet(STORAGE_KEYS.SHORT_TERM_MEMORY, all);
  }

  async clearShortTerm(companionId) {
    const all = await storageGet(STORAGE_KEYS.SHORT_TERM_MEMORY) || {};
    delete all[companionId];
    await storageSet(STORAGE_KEYS.SHORT_TERM_MEMORY, all);
  }

  async storeLongTerm(companionId, fact, category = 'general') {
    if (!companionId || !fact?.trim()) throw new Error('storeLongTerm: companionId and fact are required');
    let embedding;
    try { embedding = await this._ollama.embed(fact.trim()); }
    catch (e) { console.warn('[Memory] Embed failed:', e.message); embedding = null; }
    const id = generateId();
    const key = `vela_ltm_${companionId}`;
    const memories = await storageGet(key) || [];
    memories.push({ id, companionId, fact: fact.trim(), category, embedding, createdAt: Date.now() });
    await storageSet(key, memories);
    return id;
  }

  async retrieveRelevant(companionId, queryText, limit = MEMORY.LONG_TERM_RETRIEVAL_LIMIT) {
    const key = `vela_ltm_${companionId}`;
    const memories = await storageGet(key) || [];
    if (memories.length === 0) return [];
    if (!queryText?.trim()) {
      return memories.slice(-limit).map(({ fact, category }) => ({ fact, category, similarity: 1 }));
    }
    try {
      const qEmb = await this._ollama.embed(queryText.trim());
      return memories
        .filter((m) => Array.isArray(m.embedding))
        .map((m) => ({ fact: m.fact, category: m.category, similarity: cosineSimilarity(qEmb, m.embedding) }))
        .filter((m) => m.similarity >= MEMORY.SIMILARITY_THRESHOLD)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch {
      return memories.slice(-limit).map(({ fact, category }) => ({ fact, category, similarity: 1 }));
    }
  }

  async extractAndStore(companionId, userMessage, assistantResponse) {
    const prompt = `Extract memorable facts from this conversation.
USER: "${userMessage}"
ASSISTANT: "${assistantResponse}"
Return JSON array only, e.g. [{"fact":"...","category":"person"}] or [].`;
    try {
      const raw = await this._ollama.generate(prompt);
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return;
      const facts = JSON.parse(match[0]);
      if (!Array.isArray(facts)) return;
      for (const { fact, category } of facts) {
        if (typeof fact === 'string' && fact.trim()) {
          this.storeLongTerm(companionId, fact, category || 'general').catch(() => {});
        }
      }
    } catch { /* silent */ }
  }

  static formatMemoryContext(memories) {
    if (!memories || memories.length === 0) return '';
    const lines = memories.map(({ fact, category }) => `- [${category}] ${fact}`);
    return `\n\nWHAT YOU REMEMBER ABOUT THIS USER:\n${lines.join('\n')}\n`;
  }
}
