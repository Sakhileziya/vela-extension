import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaClient } from '../src/background/OllamaClient.js';

test('setConfig updates the active provider model and backend URL', () => {
  const client = new OllamaClient('http://localhost:11434');
  client.setConfig({ baseUrl: 'http://localhost:3000', provider: 'cloud', model: 'mistral', embedModel: 'embed' });

  assert.equal(client.baseUrl, 'http://localhost:3000');
  assert.equal(client.provider, 'cloud');
  assert.equal(client.model, 'mistral');
  assert.equal(client.embedModel, 'embed');
});

test('generate accepts an options object as the second argument', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ response: 'ok' }),
    };
  };

  try {
    const client = new OllamaClient('http://localhost:11434');
    const response = await client.generate('hello world', { temperature: 0.1 });

    assert.equal(response, 'ok');
    assert.equal(calls[0].init.body.includes('"temperature":0.1'), true);
    assert.equal(calls[0].init.body.includes('"model":"llama3.2:3b"'), true);
  } finally {
    global.fetch = originalFetch;
  }
});
