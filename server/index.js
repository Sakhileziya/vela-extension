import http from 'node:http';
import { URL } from 'node:url';
import { appendEvent, readEvents } from './storage.js';
import { extractApiKey, isAuthorized } from './auth.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const provider = process.env.AI_PROVIDER || 'ollama';
const adminApiKey = process.env.ADMIN_API_KEY || 'dev-change-me';
const rateLimitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || 120);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const requestsByIp = new Map();

function providerConfig() {
  switch (provider) {
    case 'groq':
      return {
        name: 'groq',
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      };
    case 'openai':
      return {
        name: 'openai',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      };
    case 'together':
      return {
        name: 'together',
        baseUrl: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
        apiKey: process.env.TOGETHER_API_KEY,
        model: process.env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      };
    case 'mock':
      return { name: 'mock', baseUrl: '', apiKey: null, model: 'mock-model' };
    default:
      return {
        name: 'ollama',
        baseUrl: ollamaBaseUrl,
        apiKey: null,
        model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      };
  }
}

function withCorsHeaders(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key',
    ...headers,
  };
}

function sendJson(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...withCorsHeaders(extraHeaders) });
  res.end(JSON.stringify(body));
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

function enforceRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = requestsByIp.get(ip);
  if (!entry || now - entry.startedAt > 60_000) {
    requestsByIp.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > rateLimitPerMinute) {
    sendJson(res, 429, { error: 'rate limit exceeded' });
    return false;
  }
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function buildHeaders(config) {
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

async function proxyToCloud(path, payload, config) {
  const url = new URL(path, config.baseUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(config),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider error ${response.status}: ${text}`);
  }
  return response.json();
}

async function handleChat(payload, config) {
  if (config.name === 'mock') {
    const content = payload.messages?.[0]?.content || payload.prompt || 'Mock response';
    return [{ message: { content: `Mock response to: ${content}` }, done: true }];
  }

  if (config.name === 'ollama') {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }
    const text = await response.text();
    return text ? text.split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [{ role: 'user', content: payload.prompt || '' }];
  const requestBody = {
    model: payload.model || config.model,
    messages,
    temperature: payload.options?.temperature ?? 0.7,
    max_tokens: payload.options?.num_predict ?? 1024,
    stream: false,
  };
  const data = await proxyToCloud('/chat/completions', requestBody, config);
  const content = data.choices?.[0]?.message?.content || data.response || '';
  return [{ message: { content }, done: true }];
}

async function handleGenerate(payload, config) {
  if (config.name === 'mock') {
    return { response: `Mock response to: ${payload.prompt || 'prompt'}` };
  }
  if (config.name === 'ollama') {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    return response.json();
  }
  const data = await handleChat({ ...payload, messages: [{ role: 'user', content: payload.prompt || '' }] }, config);
  const content = data[0]?.message?.content || '';
  return { response: content };
}

async function handleEmbeddings(payload, config) {
  if (config.name === 'mock') {
    return { embedding: [0.1, 0.2, 0.3] };
  }
  if (config.name === 'ollama') {
    const response = await fetch(`${config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    return response.json();
  }
  const data = await proxyToCloud('/embeddings', {
    model: payload.model || config.model,
    input: payload.prompt || payload.input || '',
  }, config);
  return { embedding: data.data?.[0]?.embedding || [] };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {}, { 'Access-Control-Allow-Origin': '*' });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (!enforceRateLimit(req, res)) return;

    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/v1/health')) {
      sendJson(res, 200, {
        ok: true,
        provider,
        configured: provider === 'mock' || provider !== 'ollama' ? true : true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/metrics' || url.pathname === '/v1/metrics')) {
      sendJson(res, 200, {
        requestsPerMinute: rateLimitPerMinute,
        activeIps: requestsByIp.size,
        provider,
      });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/models' || url.pathname === '/v1/models')) {
      const config = providerConfig();
      sendJson(res, 200, { data: [{ id: config.model, object: 'model', owned_by: 'vela' }] });
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/events' || url.pathname === '/v1/events')) {
      if (!isAuthorized(req, adminApiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const payload = await readJson(req);
      await appendEvent(payload);
      sendJson(res, 201, { ok: true, recorded: true });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/events' || url.pathname === '/v1/events')) {
      if (!isAuthorized(req, adminApiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const events = await readEvents();
      const limit = Number(url.searchParams.get('limit') || 100);
      sendJson(res, 200, { events: events.slice(-limit) });
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/chat' || url.pathname === '/v1/chat/completions')) {
      if (!isAuthorized(req, adminApiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const payload = await readJson(req);
      const config = providerConfig();
      const chunks = await handleChat(payload, config);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson', ...withCorsHeaders() });
      for (const chunk of chunks) {
        res.write(`${JSON.stringify(chunk)}\n`);
      }
      res.end();
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/generate' || url.pathname === '/v1/generate')) {
      if (!isAuthorized(req, adminApiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const payload = await readJson(req);
      const config = providerConfig();
      const result = await handleGenerate(payload, config);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && (url.pathname === '/api/embeddings' || url.pathname === '/v1/embeddings')) {
      if (!isAuthorized(req, adminApiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }
      const payload = await readJson(req);
      const config = providerConfig();
      const result = await handleEmbeddings(payload, config);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`[vela-server] listening on http://${host}:${port}`);
  console.log(`[vela-server] provider=${provider}`);
});
