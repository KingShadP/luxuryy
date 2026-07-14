const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const dbPath = path.join('/tmp', `luxuryy-test-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-2.0-flash';
process.env.GEMINI_HIGH_THINKING_BUDGET = '4096';

const { createApp, initializeDatabase } = require('../src/app');

function requestJSON(port, method, route, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: route,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('API stores submissions and handles high-thinking AI sessions', async (t) => {
  await initializeDatabase();
  const app = createApp();

  const geminiCalls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, options) => {
    geminiCalls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Residence intelligence response.' }],
            },
          },
        ],
      }),
    };
  };

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  t.after(async () => {
    global.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
  });

  const submission = await requestJSON(port, 'POST', '/api/submissions', {
    name: 'KingShadP',
    email: 'owner@example.com',
    interests: ['music', 'archive'],
  });

  assert.equal(submission.status, 201);
  assert.equal(submission.body.name, 'KingShadP');

  const submissions = await requestJSON(port, 'GET', '/api/submissions?limit=1');
  assert.equal(submissions.status, 200);
  assert.equal(submissions.body.items.length, 1);
  assert.equal(submissions.body.items[0].email, 'owner@example.com');

  const chat = await requestJSON(port, 'POST', '/api/ai/chat', {
    prompt: 'Summarize this house strategy',
    highThinking: true,
  });

  assert.equal(chat.status, 200);
  assert.equal(chat.body.highThinking, true);
  assert.equal(chat.body.response, 'Residence intelligence response.');
  assert.ok(chat.body.sessionId);

  assert.equal(geminiCalls.length, 1);
  const geminiPayload = JSON.parse(geminiCalls[0].options.body);
  assert.equal(geminiPayload.generationConfig.thinkingConfig.thinkingBudget, 4096);

  const history = await requestJSON(port, 'GET', `/api/ai/history/${chat.body.sessionId}`);
  assert.equal(history.status, 200);
  assert.equal(history.body.messages.length, 2);
  assert.equal(history.body.messages[0].role, 'user');
  assert.equal(history.body.messages[1].role, 'assistant');
});
