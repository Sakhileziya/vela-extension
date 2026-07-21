/**
 * @file utils.js
 * @description Pure utility functions. No side effects. Fully testable.
 * Each function does exactly one thing.
 */

// ─── Text Processing ──────────────────────────────────────────────────────────

/**
 * Strips HTML tags and normalises whitespace from a raw HTML string.
 * Used to clean page content before sending to the AI.
 * @param {string} html - Raw HTML content
 * @returns {string} Clean plain text
 */
export function stripHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Truncates text to a maximum character length, preserving word boundaries.
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum character count
 * @returns {string} Truncated text with ellipsis if needed
 */
export function truncate(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '…';
}

/**
 * Formats a timestamp into a human-readable time string.
 * @param {number|Date} timestamp - Unix ms timestamp or Date
 * @returns {string} Formatted time e.g. "14:32" or "01/07/2026"
 */
export function formatTimestamp(timestamp) {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.getHours().toString().padStart(2, '0') + ':' +
        d.getMinutes().toString().padStart(2, '0');
    }
    return formatDateSA(d);
  } catch {
    return '';
  }
}

export function formatRands(amount, decimals = 2) {
  if (typeof amount !== 'number' || isNaN(amount)) return 'R 0.00';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
}

export function formatDateSA(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch { return 'Invalid date'; }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
  });
}

export function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) acc[key] = obj[key];
    return acc;
  }, {});
}

export function chunk(array, size) {
  if (!Array.isArray(array) || size < 1) return [];
  const result = [];
  for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
  return result;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) throw new Error('Inputs must be arrays of equal length');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function withTimeout(promise, ms, message = 'Operation timed out') {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
  return Promise.race([promise, timeout]);
}

export async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let i = 1; i <= maxAttempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastError = e;
      if (i < maxAttempts) await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i - 1)));
    }
  }
  throw lastError;
}

export function debounce(fn,ms) {
  let timer;
  return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
}

export async function storageGet(key) {
  try { const r = await chrome.storage.local.get(key); return r[key] ?? null; }
  catch { return null; }
}

export async function storageSet(key, value) {
  try { await chrome.storage.local.set({ [key]: value }); return true; }
  catch { return false; }
}

export async function storageRemove(key) {
  try { await chrome.storage.local.remove(key); return true; }
  catch { return false; }
}

export async function sendToBackground(message) {
  try { return await chrome.runtime.sendMessage(message); }
  catch (error) { console.error('[Infinity AI] sendToBackground failed:', error); throw error; }
}
