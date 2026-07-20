/**
 * @file WorkflowEngine.js
 * @description Executes multi-step agent workflows defined by the user.
 * Each workflow is a named sequence of typed steps with optional context interpolation.
 * Workflows persist in chrome.storage.local.
 *
 * Step types:
 *  - research   { query }
 *  - navigate   { url }
 *  - click      { selector }
 *  - type       { selector, text }
 *  - extract    { } — extracts full page data
 *  - screenshot { }
 *  - generate   { prompt } — Ollama generation
 *  - wait       { ms }
 *  - open_tab   { url, active? }
 *  - scroll     { direction, amount? }
 *  - press_key  { key }
 *
 * Context interpolation: use {{stepKey}} in any string param to inject the
 * output of a previous step. Steps are keyed by their `outputKey` field or
 * fallback to `step_0`, `step_1`, etc.
 */

import { BrowseAgent } from './BrowseAgent.js';
import { ComputerAgent } from './ComputerAgent.js';
import { OllamaClient } from './OllamaClient.js';

export class WorkflowEngine {
  constructor() {
    this.browse = new BrowseAgent();
    this.computer = new ComputerAgent();
    this.ollama = new OllamaClient();
    this._aborted = false;
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  async save(workflow) {
    const { workflows = [] } = await chrome.storage.local.get('workflows');
    const idx = workflows.findIndex((w) => w.id === workflow.id);
    const record = {
      ...workflow,
      id: workflow.id || crypto.randomUUID(),
      updatedAt: Date.now(),
      createdAt: workflow.createdAt || Date.now(),
    };
    if (idx >= 0) workflows[idx] = record;
    else workflows.push(record);
    await chrome.storage.local.set({ workflows });
    return record;
  }

  async list() {
    const { workflows = [] } = await chrome.storage.local.get('workflows');
    return workflows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id) {
    const { workflows = [] } = await chrome.storage.local.get('workflows');
    await chrome.storage.local.set({ workflows: workflows.filter((w) => w.id !== id) });
  }

  // ── Execution ──────────────────────────────────────────────────────────────────

  /**
   * Run a workflow step by step.
   * @param {object} workflow - { id, name, steps: Step[] }
   * @param {function} onProgress - called after each step
   * @returns {object} context - map of outputKey => result for all steps
   */
  async run(workflow, onProgress = () => {}) {
    this._aborted = false;
    const context = {}; // shared state between steps

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        if (this._aborted) break;

        const step = workflow.steps[i];
        const key = step.outputKey || `step_${i}`;

        onProgress({ index: i, total: workflow.steps.length, step, status: 'running', context });

        try {
          const result = await this._runStep(step, context, onProgress);
          context[key] = result;
          onProgress({ index: i, total: workflow.steps.length, step, status: 'done', result, context });
        } catch (err) {
          onProgress({ index: i, total: workflow.steps.length, step, status: 'error', error: err.message, context });
          if (step.continueOnError !== true) throw err;
          context[key] = { error: err.message };
        }
      }

      return context;
    } finally {
      await this.computer.detachAll();
    }
  }

  abort() {
    this._aborted = true;
    this.browse.abort();
  }

  // ── Step Runners ─────────────────��───────────────────────────────────────────

  async _runStep(step, context, onProgress) {
    const p = this._resolve(step.params || {}, context);

    switch (step.type) {

      case 'research':
        return await this.browse.research(p.query, (update) => {
          onProgress({ type: 'research_progress', ...update });
        });

      case 'navigate': {
        const tabId = await this._activeTabId();
        return await this.computer.navigateTo(tabId, p.url);
      }

      case 'click': {
        const tabId = await this._activeTabId();
        return await this.computer.click(tabId, p.selector);
      }

      case 'type': {
        const tabId = await this._activeTabId();
        return await this.computer.type(tabId, p.selector, p.text);
      }

      case 'extract': {
        const tabId = await this._activeTabId();
        return await this.computer.extractPage(tabId);
      }

      case 'screenshot': {
        const tabId = await this._activeTabId();
        return await this.computer.screenshot(tabId);
      }

      case 'scroll': {
        const tabId = await this._activeTabId();
        return await this.computer.scroll(tabId, p.direction || 'down', p.amount || 600);
      }

      case 'press_key': {
        const tabId = await this._activeTabId();
        return await this.computer.pressKey(tabId, p.key);
      }

      case 'generate': {
        const prompt = this._interpolate(p.prompt, context);
        return await this.ollama.generate(prompt, { stream: false });
      }

      case 'open_tab': {
        const tab = await new Promise((resolve) =>
          chrome.tabs.create({ url: p.url, active: p.active !== false }, resolve)
        );
        return { tabId: tab.id, url: p.url };
      }

      case 'wait':
        await new Promise((r) => setTimeout(r, p.ms || 1000));
        return { waited: p.ms || 1000 };

      default:
        throw new Error(`Unknown step type: "${step.type}"`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async _activeTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    return tab.id;
  }

  /** Resolve all string param values, interpolating context variables. */
  _resolve(params, context) {
    return Object.fromEntries(
      Object.entries(params).map(([k, v]) => [
        k,
        typeof v === 'string' ? this._interpolate(v, context) : v,
      ])
    );
  }

  /** Replace {{key}} in a string with the corresponding context value. */
  _interpolate(template, context) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = context[key];
      if (val === undefined) return `{{${key}}}`;
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  }
}
