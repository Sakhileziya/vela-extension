/**
 * @file background/index.js
 * @description Chrome Extension Service Worker — the orchestrator.
 *
 * Responsibilities:
 *   - Instantiates and wires all core services (Ollama, Memory, Actions, Companions)
 *   - Handles all messages from the sidebar and content scripts
 *   - Opens the side panel on extension icon click
 *   - Runs periodic health checks on Ollama
 *
 * Architecture: Message-driven. The sidebar and content script never call
 * services directly — everything routes through this service worker.
 */

import { OllamaClient } from './OllamaClient.js';
import { MemoryManager } from './MemoryManager.js';
import { ActionExecutor } from './ActionExecutor.js';
import { CompanionManager } from './CompanionManager.js';
import { MSG, OLLAMA, STORAGE_KEYS } from '../shared/constants.js';
import { storageSet } from '../shared/utils.js';

const ollama = new OllamaClient(OLLAMA.BASE_URL);
const memory = new MemoryManager(ollama);
const actions = new ActionExecutor();
const companions = new CompanionManager();
const pageContextStore = new Map();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  console.log('[Infinity AI] onInstalled:', reason);
  if (reason === 'install') {
    await companions.initialise();
    console.log('[Infinity AI] Default companions seeded');
  }
  await checkOllamaHealth();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

async function checkOllamaHealth() {
  const status = await ollama.healthCheck();
  await storageSet(STORAGE_KEYS.OLLAMA_STATUS, { ...status, checkedAt: Date.now() });
  return status;
}

setInterval(checkOllamaHealth, OLLAMA.HEALTH_CHECK_INTERVAL_MS);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    sendResponse({ error: 'Message missing type field' });
    return false;
  }
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case MSG.PAGE_CONTEXT: {
        const tabId = sender.tab?.id;
        if (tabId) {
          pageContextStore.set(tabId, { url: message.url, title: message.title, content: message.content, forms: message.forms, links: message.links, capturedAt: Date.now() });
        }
        sendResponse({ ok: true });
        break;
      }
      case MSG.CHAT_SEND: {
        await handleChatSend(message, sendResponse);
        break;
      }
      case MSG.CHAT_ABORT: {
        ollama.abort();
        sendResponse({ ok: true });
        break;
      }
      case MSG.COMPANION_GET_ALL: {
        const all = await companions.getAll();
        const active = await companions.getActive();
        sendResponse({ companions: all, activeId: active?.id });
        break;
      }
      case MSG.COMPANION_SET_ACTIVE: {
        const updated = await companions.setActive(message.id);
        sendResponse({ companion: updated });
        break;
      }
      case MSG.COMPANION_CREATE: {
        const created = await companions.create(message.data);
        sendResponse({ companion: created });
        break;
      }
      case MSG.COMPANION_UPDATE: {
        const updated = await companions.update(message.id, message.data);
        sendResponse({ companion: updated });
        break;
      }
      case MSG.COMPANION_DELETE: {
        await companions.delete(message.id);
        sendResponse({ ok: true });
        break;
      }
      case MSG.MEMORY_GET: {
        const history = await memory.getShortTerm(message.companionId);
        sendResponse({ history });
        break;
      }
      case MSG.MEMORY_CLEAR: {
        await memory.clearShortTerm(message.companionId);
        sendResponse({ ok: true });
        break;
      }
      case MSG.ACTION_EXECUTE: {
        const result = await actions.execute(message.action);
        sendResponse(result);
        break;
      }
      case MSG.POPIA_GET_STATUS: {
        const consent = await chrome.storage.local.get([STORAGE_KEYS.POPIA_CONSENT, STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP_]);
        sendResponse({ consented: consent[STORAGE_KEYS.POPIA_CONSENT] === true, timestamp: consent[STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP_] || null });
        break;
      }
      case MSG.POPIA_SET_CONSENT: {
        await storageSet(STORAGE_KEYS.POPIA_CONSENT, message.consented);
        await storageSet(STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP_, Date.now());
        sendResponse({ ok: true });
        break;
      }
      case MSG.OLLAMA_HEALTH: {
        const status = await checkOllamaHealth();
        sendResponse(status);
        break;
      }
      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    console.error('[Infinity AI] Message handler error:', error);
    sendResponse({ error: error.message });
  }
}

async function handleChatSend(message, sendResponse) {
  const { companionId, userMessage } = message;
  if (!companionId || !userMessage?.trim()) {
    sendResponse({ error: 'companionId and userMessage are required' });
    return;
  }
  const companion = await companions.getById(companionId);
  if (!companion) { sendResponse({ error: `Companion not found: ${companionId}` }); return; }
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageContext = activeTab ? pageContextStore.get(activeTab.id) : null;
  const pageContextStr = pageContext
    ? `URL: ${pageContext.url}\nTitle: ${pageContext.title}\n\nPage content:\n${pageContext.content?.substring(0, 3000)}`
    : 'No page context available.';
  const relevantMemories = await memory.retrieveRelevant(companionId, userMessage + ' ' + (pageContext?.title || ''));
  const memoryContext = MemoryManager.formatMemoryContext(relevantMemories);
  const systemPrompt = CompanionManager.buildSystemPrompt(companion, pageContextStr, memoryContext);
  const history = await memory.getShortTerm(companionId);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: userMessage.trim() },
  ];
  await memory.appendShortTerm(companionId, { role: 'user', content: userMessage.trim() });
  let fullResponse = '';
  let responded = false;
  await ollama.chat({
    messages,
    onChunk: (token) => {
      fullResponse += token;
      chrome.runtime.sendMessage({ type: MSG.STREAM_CHUNK, token }).catch(() => {});
      if (!responded) { responded = true; sendResponse({ streaming: true }); }
    },
    onDone: async (text) => {
      chrome.runtime.sendMessage({ type: MSG.STREAM_DONE }).catch(() => {});
      await memory.appendShortTerm(companionId, { role: 'assistant', content: text });
      memory.extractAndStore(companionId, userMessage, text).catch(() => {});
    },
    onError: (error) => {
      chrome.runtime.sendMessage({ type: MSG.STREAM_ERROR, error: error.message }).catch(() => {});
      if (!responded) { responded = true; sendResponse({ error: error.message }); }
    },
  });
}
