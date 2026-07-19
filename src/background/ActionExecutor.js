/**
 * @file ActionExecutor.js
 * @description Executes browser automation actions on the active tab.
 * Uses chrome.scripting.executeScript to inject and run code in the page context.
 * All actions are explicit and logged â€” no silent execution.
 */

import { ACTION, ERRORS } from '../shared/constants.js';

export class ActionExecutor {
  /**
   * Executes a browser action on the active tab.
   * @param {{ type: string, payload: Object }} action - Action descriptor
   * @returns {Promise<{ success: boolean, result?: any, error?: string }>}
   */
  async execute(action) {
    if (!action?.type) {
      return { success: false, error: 'Invalid action: missing type' };
    }

    const tab = await this._getActiveTab();
    if (!tab) {
      return { success: false, error: 'No active tab found' };
    }

    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      return { success: false, error: 'Cannot execute actions on browser system pages' };
    }

    try {
      switch (action.type) {
        case ACTION.CLICK: return await this._click(tab.id, action.payload);
        case ACTION.TYPE: return await this._type(tab.id, action.payload);
        case ACTION.SCROLL: return await this._scroll(tab.id, action.payload);
        case ACTION.EXTRACT8€Xeturn await this._extract(tab.id, action.payload);
        case ACTION.NAVIGATE: return await this._navigate(tab.id, action.payload);
        case ACTION.SUBMIT_FORM: return await this._submitForm(tab.id, action.payload);
        case ACTION.HIGHLIGHT: return await this._highlight(tab.id, action.payload);
        default: return { success: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (error) {
      console.error('[ActionExecutor] Action failed:', error);
      return { success: false, error: ERRORS.ACTION_FAILED };
    }
  }

  async _click(tabId, { selector, text }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector, text) => {
        let el = selector ? document.querySelector(selector) : null;
        if (!el && text) {
          const all = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
          for (const node of all) {
            if (node.textContent?.trim().toLowerCase().includes(text.toLowerCase())) { el = node; break; }
          }
        }
        if (!el) return { success: false, error: 'Element not found' };
        el.click();
        return { success: true };
      },
      args: [selector, text],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _type(tabId, { selector, value }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector, value) => {
        const el = document.querySelector(selector);
        if (!el) return { success: false, error: 'Input not found' };
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      },
      args: [selector, value],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _scroll(tabId, { direction = 'down', amount = 500 }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (direction, amount) => {
        window.scrollBy({ top: direction === 'up' ? -amount : amount, behavior: 'smooth' });
        return { success: true };
      },
      args: [direction, amount],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _extract(tabId, { selector }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const els = document.querySelectorAll(selector);
        if (!els.length) return { success: false, error: 'No elements found' };
        return { success: true, data: Array.from(els).map(el => ({ text: el.textContent?.trim(), href: el.href })) };
      },
      args: [selector],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _navigate(tabId, { url }) {
    await chrome.tabs.update(tabId, { url });
    return { success: true, url };
  }

  async _submitForm(tabId, { selector }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const form = selector ? document.querySelector(selector) : document.querySelector('form');
        if (!form) return { success: false, error: 'Form not found' };
        form.submit();
        return { success: true };
      },
      args: [selector],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _highlight(tabId, { selector, color = '#FFD700' }) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector, color) => {
        const els = document.querySelectorAll(selector);
        els.forEach(el => { el.style.outline = `3px solid ${color}`; setTimeout(() => el.style.outline = '', 3000); });
        return { success: true, count: els.length };
      },
      args: [selector, color],
    });
    return results[0]?.result || { success: false, error: ERRORS.ACTION_FAILED };
  }

  async _getActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab || null;
    } catch { return null; }
  }
}
