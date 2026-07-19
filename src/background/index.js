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

// ─── Service Initialisation ───────────────────────────────────────────────────
// Single instances — services are stateless and safe to reuse across messages.

const ollama = new OllamaClient(OLLAMA.BASE_URL);
const memory = new MemoryManager(ollama);
const actions = new ActionExecutor();
const companions = new CompanionManager();

// In-memory page context store: tabId → { url, title, content }
const pageContextStore = new Map();

// ─── Extension Lifecycle ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  console.log('[Vela] onInstalled:', reason);

  // Seed default companions on fresh install
  if (reason === 'install') {
    await companions.initialise();
    console.log('[Vela] Default companions seeded');
  }

  // Run initial Ollama health check
  await checkOllamaHealth();
});

// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ─── Periodic Health Check ────────────────────────────────────────────────────

async function checkOllamaHealth() {
  const status = await ollama.healthCheck();
  await storageSet(STORAGE_KEYS.OLLAMA_STATUS, {
    ...status,
    checkedAt: Date.now(),
  });
  return status;
}

// Check Ollama health every 60 seconds
setInterval(checkOllamaHealth, OLLAMA.HEALTH_CHECK_INTERVAL_MS);

// ─── Message Router ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    sendResponse({ error: 'Message missing type field' });
    return false;
  }

  // Return true to signal we will respond asynchronously
  handleMessage(message, sender, sendResponse);
  return true;
});

/**
 * Routes incoming messages to the appropriate handler.
 * All handlers are async — results sent via sendResponse.
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      // ── Content script: page context update ──
      case MSG.PAGE_CONTEXT: {
        const tabId = sender.tab?.id;
        if (tabId) {
          pageContextStore.set(tabId, {
            url: message.url,
            title: message.title,
            content: message.content,
            forms: message.forms,
            links: message.links,
            capturedAt: Date.now(),
          });
        }
        sendResponse({ ok: true });
        break;
      }

      // ── Chat: streaming response ──
      case MSG.CHAT_SEND: {
        await handleChatSend(message, sendResponse);
        break;
      }

      // ── Chat: abort streaming ──
      case MSG.CHAT_ABORT: {
        ollama.abort();
        sendResponse({ ok: true });
        break;
      }

      // ── Companions ──
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

      // ── Memory ──
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

      // ── Actions ──
      case MSG.ACTION_EXECUTE: {
        const result = await actions.execute(message.action);
        sendResponse(result);
        break;
      }

      // ── POPIA ──
      case MSG.POPIA_GET_STATUS: {
        const consent = await chrome.storage.local.get([
          STORAGE_KEYS.POPIA_CONSENT,
          STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP,
        ]);
        sendResponse({
          consented: consent[STORAGE_KEYS.POPIA_CONSENT] === true,
          timestamp: consent[STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP] || null,
        });
        break;
      }

      case MSG.POPIA_SET_CONSENT: {
        await storageSet(STORAGE_KEYS.POPIA_CONSENT, message.consented);
        await storageSet(STORAGE_KEYS.POPIA_CONSENT_TIMESTAMP, Date.now());
        sendResponse({ ok: true });
        break;
      }

      // ── Ollama health ──
      case MSG.OLLAMA_HEALTH: {
        const status = await checkOllamaHealth();
        sendResponse(status);
        break;
      }

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    console.error('[Vela] Message handler error:', error);
    sendResponse({ error: error.message });
  }
}

// ─── Chat Handler ─────────────────────────────────────────────────────────────

/**
 * Handles a chat message from the sidebar.
 * Builds full context (companion + page + memories), streams the response,
 * and extracts facts for long-term memory after the conversation.
 *
 * @param {Object} message - { companionId, userMessage }
 * @param {Function} sendResponse
 */
async function handleChatSend(message, sendResponse) {
  const { companionId, userMessage } = message;

  if (!companionId || !userMessage?.trim()) {
    sendResponse({ error: 'companionId and userMessage are required' });
    return;
  }

  // 1. Load companion config
  const companion = await companions.getById(companionId);
  if (!companion) {
    sendResponse({ error: `Companion not found: ${companionId}` });
    return;
  }

  // 2. Get current page context
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageContext = activeTab ? pageContextStore.get(activeTab.id) : null;
  const pageContextString = pageContext
    ? `URL: ${pageContext.url}\nTitle: ${pageContext.title}\n\nPage content:\n${pageContext.content?.substring(0, 3000)}`
    : 'No page context available.';

  // 3. Retrieve relevant long-term memories
  const relevantMemories = await memory.retrieveRelevant(
    companionId,
    userMessage + ' ' + (pageContext?.title || '')
  );
  const memoryContext = MemoryManager.formatMemoryContext(relevantMemories);

  // 4. Build full system prompt
  const systemPrompt = CompanionManager.buildSystemPrompt(companion, pageContextString, memoryContext);

  // 5. Load short-term history
  const history = await memory.getShortTerm(companionId);

  // 6. Build the messages array for Ollama
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: userMessage.trim() },
  ];

  // 7. Store the user message immediately
  await memory.appendShortTerm(companionId, { role: 'user', content: userMessage.trim() });

  // 8. Stream response to sidebar via runtime.sendMessage
  let fullResponse = '';
  let responded = false;

  await ollama.chat({
    messages,
    onChunk: (token) => {
      fullResponse += token;
      // Send each token to sidebar — sidebar listens for STREAM_CHUNK messages
      chrome.runtime.sendMessage({ type: MSG.STREAM_CHUNK, token }).catch(() => {});

      // Acknowledge the original sendResponse on first chunk
      if (!responded) {
        responded = true;
        sendResponse({ streaming: true });
      }
    },
    onDone: async (text) => {
      chrome.runtime.sendMessage({ type: MSG.STREAM_DONE }).catch(() => {});

      // Store the complete assistant response in memory
      await memory.appendShortTerm(companionId, { role: 'assistant', content: text });

      // Extract and store long-term facts (fire and forget)
      memory.extractAndStore(companionId, userMessage, text).catch(() => {});
    },
    onError: (error) => {
      chrome.runtime.sendMessage({
        type: MSG.STREAM_ERROR,
        error: error.message,
      }).catch(() => {});

      if (!responded) {
        responded = true;
        sendResponse({ error: error.message });
      }
    },
  });
}
