/**
 * @file ComputerAgent.js
 * @description Full browser control via Chrome Debugger Protocol.
 * Enables click, type, scroll, screenshot, navigate on any tab.
 */

export class ComputerAgent {
  constructor(ollamaClient) {
    this.ollama = ollamaClient;
  }

  async navigateTo(tabId, url) {
    return this._navigate(tabId, url);
  }

  async click(tabId, selector) {
    return this._click(tabId, selector);
  }

  async type(tabId, selector, text) {
    return this._type(tabId, selector, text);
  }

  async extractPage(tabId) {
    return this._extract(tabId);
  }

  async screenshot(tabId) {
    return this._screenshot(tabId);
  }

  async scroll(tabId, direction, amount) {
    return this._scroll(tabId, direction, amount);
  }

  async pressKey(tabId, key) {
    return this._pressKey(tabId, key);
  }

  async detachAll() {
    return true;
  }

  async execute(tabId, instruction) {
    const steps = await this._plan(instruction);
    const results = [];
    for (const step of steps) {
      try {
        const result = await this._runStep(tabId, step);
        results.push({ step, result, status: 'done' });
      } catch (err) {
        results.push({ step, error: err.message, status: 'error' });
        break;
      }
    }
    return results;
  }

  async _plan(instruction) {
    const prompt = `You are a browser automation planner.
Convert this instruction into a JSON array of steps.
Each step: { "action": "click|type|scroll|navigate|screenshot|extract|wait", "selector": "css (if needed)", "value": "text or url (if needed)", "description": "what this does" }
Instruction: ${instruction}
Return ONLY valid JSON array, no explanation.`;

    const response = await this.ollama.generate(prompt, { temperature: 0.1 });
    try {
      const match = response.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [];
    }
  }

  async _runStep(tabId, step) {
    switch (step.action) {
      case 'navigate':
        return await this._navigate(tabId, step.value);
      case 'click':
        return await this._click(tabId, step.selector);
      case 'type':
        return await this._type(tabId, step.selector, step.value);
      case 'scroll':
        return await this._scroll(tabId, step.value || 'down');
      case 'screenshot':
        return await this._screenshot(tabId);
      case 'extract':
        return await this._extract(tabId);
      case 'wait':
        return await this._wait(parseInt(step.value) || 1000);
      default:
        return `Unknown action: ${step.action}`;
    }
  }

  async _navigate(tabId, url) {
    await chrome.tabs.update(tabId, { url });
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    return `Navigated to ${url}`;
  }

  async _click(tabId, selector) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);
        el.click();
      },
      args: [selector],
    });
    return `Clicked ${selector}`;
  }

  async _type(tabId, selector, text) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Element not found: ${sel}`);
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      args: [selector, text],
    });
    return `Typed "${text}" into ${selector}`;
  }

  async _scroll(tabId, direction, amount = 400) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (dir, amt) => {
        const map = { down: [0, amt], up: [0, -amt], top: [0, -99999], bottom: [0, 99999] };
        const [x, y] = map[dir] || [0, amt];
        window.scrollBy(x, y);
      },
      args: [direction, amount],
    });
    return `Scrolled ${direction}`;
  }

  async _pressKey(tabId, key) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (value) => {
        const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
        document.dispatchEvent(event);
      },
      args: [key],
    });
    return `Pressed ${key}`;
  }

  async _screenshot(tabId) {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 70 });
    return dataUrl;
  }

  async _extract(tabId) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText.slice(0, 8000),
    });
    return result;
  }

  async _wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return `Waited ${ms}ms`;
  }
}