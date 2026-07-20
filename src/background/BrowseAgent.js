/**
 * @file BrowseAgent.js
 * @description Autonomous web research agent. Opens tabs, extracts page content,
 * and synthesizes findings using local Ollama. Zero data leaves the device.
 *
 * Design constraints:
 * - Max 3 concurrent research tabs (8GB RAM protection)
 * - Each page extraction has a 15s timeout
 * - Uses DuckDuckGo HTML (no API key required)
 * - All synthesis via llama3.2:3b
 */

import { OllamaClient } from './OllamaClient.js';

const MAX_RESEARCH_TABS = 3;
const EXTRACT_TIMEOUT_MS = 15_000;

export class BrowseAgent {
  constructor() {
    this.ollama = new OllamaClient();
    this._openTabs = new Set();
    this._abort = false;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Research a query autonomously.
   * @param {string} query
   * @param {function} onProgress - called with { stage, message, [urls] }
   * @returns {Promise<{ summary: string, sources: string[] }>}
   */
  async research(query, onProgress = () => {}) {
    this._abort = false;

    try {
      // 1. Search
      onProgress({ stage: 'searching', message: `Searching: "${query}"` });
      const urls = await this._searchUrls(query);

      if (urls.length === 0) {
        return { summary: 'No relevant sources found. Try rephrasing the query.', sources: [] };
      }

      onProgress({ stage: 'planning', message: `Found ${urls.length} sources`, urls });

      // 2. Browse each URL sequentially (memory-safe)
      const extracts = [];
      const limit = Math.min(urls.length, MAX_RESEARCH_TABS);

      for (let i = 0; i < limit; i++) {
        if (this._abort) break;
        const url = urls[i];
        onProgress({ stage: 'browsing', message: `Reading source ${i + 1}/${limit}: ${new URL(url).hostname}` });

        const content = await this._extractUrl(url);
        if (content) extracts.push({ url, content });
      }

      if (extracts.length === 0) {
        return { summary: 'Could not read any sources. Try a different search query.', sources: [] };
      }

      // 3. Synthesize
      onProgress({ stage: 'synthesizing', message: `Synthesizing ${extracts.length} sources…` });
      const summary = await this._synthesize(query, extracts);

      return { summary, sources: extracts.map((e) => e.url) };
    } finally {
      await this._closeOpenTabs();
    }
  }

  abort() {
    this._abort = true;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Uses DuckDuckGo HTML search and asks Ollama to pick the 3 best URLs.
   */
  async _searchUrls(query) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const html = await this._extractUrl(searchUrl, true);
    if (!html) return [];

    const prompt = `Extract exactly 3 full URLs from this DuckDuckGo search results page that best answer: "${query}".
Respond with ONLY a valid JSON array of 3 URLs. No explanation.
Example: ["https://example.com/article", "https://other.com/post", "https://third.com/page"]

Page content (truncated):
${html.substring(0, 2500)}`;

    try {
      const raw = await this.ollama.generate(prompt, { stream: false });
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) {
        const urls = JSON.parse(match[0]);
        return urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
      }
    } catch (e) {
      console.error('[Infinity AI BrowseAgent] URL extraction error:', e.message);
    }
    return [];
  }

  /**
   * Opens a tab, waits for it to load, extracts text, then closes the tab.
   * @param {string} url
   * @param {boolean} rawHtml - if true, return innerText including nav/footer
   */
  async _extractUrl(url, rawHtml = false) {
    return new Promise((resolve) => {
      let tabId = null;

      const done = (result) => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (tabId !== null) {
          chrome.tabs.remove(tabId).catch(() => {});
          this._openTabs.delete(tabId);
        }
        resolve(result);
      };

      const timer = setTimeout(() => done(null), EXTRACT_TIMEOUT_MS);

      chrome.tabs.create({ url, active: false }, (tab) => {
        if (!tab) { done(null); return; }
        tabId = tab.id;
        this._openTabs.add(tabId);

        const onUpdated = (updatedId, changeInfo) => {
          if (updatedId !== tabId || changeInfo.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(onUpdated);

          const extractFn = rawHtml
            ? () => document.body?.innerText?.replace(/\s+/g, ' ').substring(0, 3000) || ''
            : () => {
                const clone = document.body?.cloneNode(true);
                if (!clone) return '';
                clone.querySelectorAll(
                  'script,style,nav,footer,header,aside,[role="banner"],[role="navigation"],[role="complementary"]'
                ).forEach((el) => el.remove());
                return (clone.innerText || '').replace(/\s+/g, ' ').substring(0, 3000);
              };

          chrome.scripting.executeScript(
            { target: { tabId }, func: extractFn },
            (results) => {
              done(results?.[0]?.result || null);
            }
          );
        };

        chrome.tabs.onUpdated.addListener(onUpdated);
      });
    });
  }

  async _synthesize(query, extracts) {
    const sourcesText = extracts
      .map((e, i) => `--- Source ${i + 1}: ${e.url} ---\n${e.content}`)
      .join('\n\n');

    const prompt = `You are a business research assistant. The user runs a small business and asked: "${query}"

Using the source material below, write a clear and actionable research summary.

Format your response as:
## Key Findings
- (3-5 bullet points)

## Recommendations for Your Business
- (2-3 practical action points)

## Limitations
- (any important caveats)

Sources:
${sourcesText.substring(0, 5500)}`;

    return await this.ollama.generate(prompt, { stream: false });
  }

  async _closeOpenTabs() {
    for (const tabId of this._openTabs) {
      await chrome.tabs.remove(tabId).catch(() => {});
    }
    this._openTabs.clear();
  }
}
