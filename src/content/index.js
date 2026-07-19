/**
 * @file content/index.js
 * @description Content script â€” injected into every webpage the user visits.
 * Extracts page context and sends it to the background service worker.
 * SECURITY: Never eval() or execute arbitrary strings from the background.
 */

const MAX_CONTENT_LENGTH = 8000;
const MAX_LINKS = 30;
const MAX_FORM_FIELDS = 20;
const DE@ïUNCE_MS = 1500;

function extractPageContext() {
  const selectors = ['article', 'main', '[role="main"]', '.content', '#content', 'body'];
  let contentEl = null;
  for (const s of selectors) { contentEl = document.querySelector(s); if (contentEl) break; }
  const rawText = contentEl ? contentEl.innerText : document.body.innerText;
  const cleanText = rawText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim().substring(0, MAX_CONTENT_LENGTH);
  const forms = Array.from(document.forms).slice(0, 5).map((form, i) => ({
    formIndex: i, action: form.action, method: form.method,
    fields: Array.from(form.elements).filter((e) => e.name && e.type !== 'hidden').slice(0, MAX_FORM_FIELDS).map((el) => ({
      name: el.name, type: el.type, id: el.id, placeholder: el.placeholder, required: el.required,
      value: el.type === 'password' ? '[REDACTED]' : (el.value || ''),
      label: findLabel(el),
    })),
  })).filter((f) => f.fields.length > 0);
  const links = Array.from(document.querySelectorAll('a[href]'))
    .filter((a) => a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('mailto:') && a.textContent?.trim().length > 0)
    .slice(0, MAX_LINKS).map((a) => ({ text: a.textContent.trim().substring(0, 80), href: a.href }));
  return { title: document.title, url: window.location.href, content: cleanText, forms, links, extractedAt: Date.now() };
}

function findLabel(el) {
  if (el.id) { const lab = document.querySelector(`label[for="${el.id}"]`); if (lab) return lab.textContent.trim(); }
  const parent = el.closest('label');
  if (parent) return parent.textContent.trim();
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  return '';
}

async function sendPageContext() {
  try { await chrome.runtime.sendMessage({ type: 'PAGE_CONTEXT', ...extractPageContext() }); }
  catch { /* background not ready */ }
}

let debounceTimer = null;
function debouncedSend() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sendPageContext, DEBOUNCE_MS);
}

sendPageContext();

const observer = new MutationObserver((mutations) => {
  if (mutations.some((m) => m.type === 'childList' && m.addedNodes.length > 0)) debouncedSend();
});
observer.observe(document.body, { childList: true, subtree: true });

let lastUrl = window.location.href;
const urlPoller = setInterval(() => {
  if (window.location.href !== lastUrl) { lastUrl = window.location.href; debouncedSend(); }
}, 1000);

window.addEventListener('beforeunload', () => {
  observer.disconnect(); clearInterval(urlPoller); clearTimeout(debounceTimer);
});
