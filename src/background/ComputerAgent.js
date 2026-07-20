/**
 * @file ComputerAgent.js
 * @description Full browser automation via the Chrome Debugger Protocol (CDP).
 * Enables the AI to click, type, navigate, screenshot, and extract structured
 * data from any web page — exactly what Chrome DevTools does internally.
 *
 * Usage: attach to a tab → send CDP commands → detach when done.
 * Always call detachAll() when finished to release the debugger lock.
 */

const SLEEP_BETWEEN_KEYSTROKES_MS = 25;
const PAGE_LOAD_TIMEOUT_MS = 12_000;

export class ComputerAgent {
  constructor() {
    /** @type {Set<number>} tabIds currently attached */
    this._attached = new Set();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async attach(tabId) {
    if (this._attached.has(tabId)) return;
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`attach failed: ${chrome.runtime.lastError.message}`));
        } else {
          this._attached.add(tabId);
          resolve();
        }
      });
    });
  }

  async detach(tabId) {
    if (!this._attached.has(tabId)) return;
    await new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        this._attached.delete(tabId);
        resolve();
      });
    });
  }

  async detachAll() {
    for (const tabId of [...this._attached]) {
      await this.detach(tabId).catch(() => {});
    }
  }

  // ── Core CDP Command ─────────────────────────────────────────────────────────

  async cmd(tabId, method, params = {}) {
    await this.attach(tabId);
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`${method} failed: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(result);
        }
      });
    });
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  /**
   * Navigate the active tab to a URL and wait for the page to fully load.
   */
  async navigateTo(tabId, url) {
    await this.cmd(tabId, 'Page.navigate', { url });
    await this._waitForLoad(tabId);
    return { success: true, url };
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  /**
   * Click an element identified by a CSS selector.
   */
  async click(tabId, selector) {
    const result = await this.cmd(tabId, 'Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { success: false, error: 'Not found: ' + ${JSON.stringify(selector)} };
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.focus();
          el.click();
          return { success: true, tag: el.tagName, id: el.id || null };
        })()
      `,
      returnByValue: true,
      awaitPromise: false,
    });
    return result?.result?.value ?? { success: false };
  }

  /**
   * Type text into an input field identified by a CSS selector.
   * Clears the field first, then simulates real keystrokes.
   */
  async type(tabId, selector, text) {
    // Clear and focus
    await this.cmd(tabId, 'Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return;
          el.focus();
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `,
    });

    await this._sleep(200);

    // Type character by character (realistic simulation)
    for (const char of String(text)) {
      await this.cmd(tabId, 'Input.dispatchKeyEvent', { type: 'char', text: char });
      await this._sleep(SLEEP_BETWEEN_KEYSTROKES_MS);
    }

    return { success: true, typed: text };
  }

  /**
   * Press a named key (e.g. "Enter", "Tab", "Escape").
   */
  async pressKey(tabId, key) {
    await this.cmd(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', key });
    await this._sleep(50);
    await this.cmd(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', key });
    return { success: true, key };
  }

  /**
   * Scroll the page.
   * @param {number} tabId
   * @param {'up'|'down'|'top'|'bottom'} direction
   * @param {number} amount - pixels to scroll (ignored for top/bottom)
   */
  async scroll(tabId, direction = 'down', amount = 600) {
    const expr = {
      down: `window.scrollBy(0, ${amount})`,
      up: `window.scrollBy(0, -${amount})`,
      top: `window.scrollTo(0, 0)`,
      bottom: `window.scrollTo(0, document.body.scrollHeight)`,
    }[direction] || fwindow.scrollBy(0, ${amount})`;

    await this.cmd(tabId, 'Runtime.evaluate', { expression: expr });
    return { success: true, direction };
  }

  // ── Data Extraction ──────────────────────────────────────────────────────────

  /**
   * Extract structured page data: title, URL, headings, links, text, forms.
   */
  async extractPage(tabId) {
    const result = await this.cmd(tabId, 'Runtime.evaluate', {
      expression: `
        (function() {
          return JSON.stringify({
            title: document.title,
            url: location.href,
            headings: Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 15)
              .map(h => h.innerText.trim()).filter(Boolean),
            links: Array.from(document.querySelectorAll('a[href]')).slice(0, 30)
              .map(a => ({ text: a.innerText.trim().substring(0, 80), href: a.href }))
              .filter(l => l.text),
            bodyText: (document.body?.innerText || '').replace(/\\s+/g, ' ').substring(0, 4000),
            forms: Array.from(document.querySelectorAll('form')).map(f => ({
              action: f.action,
              fields: Array.from(f.querySelectorAll('input,select,textarea')).map(i => ({
                tag: i.tagName, type: i.type, name: i.name, id: i.id,
                placeholder: i.placeholder, value: i.value
              }))
            })),
            buttons: Array.from(document.querySelectorAll('button,[role="button"]')).slice(0, 20)
              .map(b => ({ text: b.innerText.trim(), id: b.id, cls: b.className.substring(0, 60) }))
          });
        })()
      `,
      returnByValue: true,
    });
    const raw = result?.result?.value;
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Take a JPEG screenshot of the current tab viewport.
   * @returns {string|null} base64 data URI
   */
  async screenshot(tabId) {
    const result = await this.cmd(tabId, 'Page.captureScreenshot', {
      format: 'jpeg',
      quality: 55,
    });
    return result?.data ? `data:image/jpeg;base64,${result.data}` : null;
  }

  /**
   * Evaluate arbitrary JavaScript in the tab context.
   * Use sparingly — prefer the typed methods above.
   */
  async evaluate(tabId, expression) {
    const result = await this.cmd(tabId, 'Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result?.result?.value ?? null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async _waitForLoad(tabId) {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, PAGE_LOAD_TIMEOUT_MS);

      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }
}
