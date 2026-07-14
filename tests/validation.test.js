const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSubmission, validatePrompt } = require('../src/validation');

test('validateSubmission normalizes valid input', () => {
  const result = validateSubmission({
    name: '  KingShadP  ',
    email: ' OWNER@EXAMPLE.COM ',
    interests: [' music ', '', 'archive'],
  });

  assert.equal(result.name, 'KingShadP');
  assert.equal(result.email, 'owner@example.com');
  assert.deepEqual(result.interests, ['music', 'archive']);
});

test('validateSubmission throws on invalid email', () => {
  assert.throws(() => validateSubmission({ name: 'abc', email: 'wrong' }));
});

test('validatePrompt validates bounds and normalizes', () => {
  const result = validatePrompt({ prompt: '  Explain the archive ', highThinking: 1, sessionId: ' abc ' });
  assert.equal(result.prompt, 'Explain the archive');
  assert.equal(result.highThinking, true);
  assert.equal(result.sessionId, 'abc');
});

test('validatePrompt rejects short prompts', () => {
  assert.throws(() => validatePrompt({ prompt: 'a' }));
});
