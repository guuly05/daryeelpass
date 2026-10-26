import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpaqueToken, hashToken } from '../../src/tokens.js';

test('creates unpredictable URL-safe tokens', () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.match(first, /^[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(first, second);
});

test('hashes the same token consistently without returning the raw token', () => {
  const token = createOpaqueToken();
  const digest = hashToken(token);

  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(hashToken(token), digest);
  assert.notEqual(digest, token);
});
