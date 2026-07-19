/**
 * @file CompanionManager.js
 * @description CRUD operations for AI companion configurations.
 * Companions are stored in Chrome local storage.
 * Validates all inputs before persistence.
 */

import { STORAGE_KEYS, DEFAULT_COMPANIONS } from '../shared/constants.js';
import { storageGet, storageSet, generateId, deepClone } from '../shared/utils.js';

export class CompanionManager {
  async initialise() {
    const existing = await storageGet(STORAGE_KEYS.COMPANIONS);
    if (!existing || Object.keys(existing).length === 0) {
      const defaults = {};
      for (const companion of DEFAULT_COMPANIONS) {
        defaults[companion.id] = { ...companion, createdAt: Date.now() };
      }
      await storageSet(STORAGE_KEYS.COMPANIONS, defaults);
      await storageSet(STORAGE_KEYS.ACTIVE_COMPANION_ID, DEFAULT_COMPANIONS[0].id);
    }
  }

  async getAll() {
    const companions = await storageGet(STORAGE_KEYS.COMPANIONS) || {};
    return Object.values(companions).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  async getById(id) {
    if (!id) return null;
    const companions = await storageGet(STORAGE_KEYS.COMPANIONS) || {};
    return companions[id] || null;
  }

  async getActive() {
    const activeId = await storageGet(STORAGE_KEYS.ACTIVE_COMPANION_ID);
    if (activeId) {
      const companion = await this.getById(activeId);
      if (companion) return companion;
    }
    const all = await this.getAll();
    if (all.length > 0) {
      await storageSet(STORAGE_KEYS.ACTIVE_COMPANION_ID, all[0].id);
      return all[0];
    }
    return null;
  }

  async create(data) {
    this._validate(data);
    const companion = {
      id: generateId(),
      name: data.name.trim(),
      role: data.role.trim(),
      system_prompt: data.system_prompt.trim(),
      color: data.color || '#1B7A4A',
      language: data.language || 'en',
      tools: data.tools || ['read_page', 'summarise'],
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const companions = await storageGet(STORAGE_KEYS.COMPANIONS) || {};
    companions[companion.id] = companion;
    await storageSet(STORAGE_KEYS.COMPANIONS, companions);
    return deepClone(companion);
  }

  async update(id, updates) {
    if (!id) throw new Error('update: companion ID is required');
    const companions = await storageGet(STORAGE_KEYS.COMPANIONS) || {};
    if (!companions[id]) throw new Error(`Companion not found: ${id}`);
    const { id: _, createdAt: __, isDefault: ___, ...safeUpdates } = updates;
    companions[id] = { ...companions[id], ...safeUpdates, updatedAt: Date.now() };
    await storageSet(STORAGE_KEYS.COMPANIONS, companions);
    return deepClone(companions[id]);
  }

  async delete(id) {
    if (!id) throw new Error('delete: companion ID is required');
    const companions = await storageGet(STORAGE_KEYS.COMPANIONS) || {};
    if (!companions[id]) throw new Error(`Companion not found: ${id}`);
    const count = Object.keys(companions).length;
    if (count <= 1) throw new Error('Cannot delete the last companion');
    delete companions[id];
    await storageSet(STORAGE_KEYS.COMPANIONS, companions);
    const activeId = await storageGet(STORAGE_KEYS.ACTIVE_COMPANION_ID);
    if (activeId === id) {
      const remaining = Object.keys(companions);
      if (remaining.length > 0) {
        await storageSet(STORAGE_KEYS.ACTIVE_COMPANION_ID, remaining[0]);
      }
    }
  }

  async setActive(id) {
    const companion = await this.getById(id);
    if (!companion) throw new Error(`Companion not found: ${id}`);
    await storageSet(STORAGE_KEYS.ACTIVE_COMPANION_ID, id);
    return companion;
  }

  static buildSystemPrompt(companion, pageContext = '', memoryContext = '') {
    let prompt = companion.system_prompt || '';
    if (pageContext) prompt += `\n\n--- CURRENT PAGE CONTEXT ---\n${pageContext}\n--- END PAGE CONTEXT ---`;
    if (memoryContext) prompt += memoryContext;
    prompt += `\n\nDATA NOTICE: All processing is local on the user's device. No data is sent to external servers. POPIA compliant.`;
    return prompt;
  }

  _validate(data) {
    if (!data?.name?.trim()) throw new Error('Companion name is required');
    if (data.name.trim().length > 50) throw new Error('Companion name must be 50 characters or fewer');
    if (!data?.role?.trim()) throw new Error('Companion role is required');
    if (!data?.system_prompt?.trim()) throw new Error('System prompt is required');
    if (data.system_prompt.trim().length < 20) throw new Error('System prompt must be at least 20 characters');
  }
}
