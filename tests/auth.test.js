import test from 'node:test';
import assert from 'node:assert/strict';
import { extractApiKey, isAuthorized } from '../server/auth.js';

test('extractApiKey reads x-api-key header', () => {
  const req = { headers: { 'x-api-key': 'abc123' } };
  assert.equal(extractApiKey(req), 'abc123');
});

test('extractApiKey reads Authorization Bearer header', () => {
  const req = { headers: { authorization: 'Bearer xyz789' } };
  assert.equal(extractApiKey(req), 'xyz789');
});

test('isAuthorized accepts matching key', () => {
  const req = { headers: { 'x-api-key': 'secret' } };
  assert.equal(isAuthorized(req, 'secret'), true);
});

test('isAuthorized rejects mismatched key', () => {
  const req = { headers: { 'x-api-key': 'wrong' } };
  assert.equal(isAuthorized(req, 'secret'), false);
});
