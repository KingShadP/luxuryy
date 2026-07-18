const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase, run, all } = require('./database');
const { validateSubmission, validatePrompt } = require('./validation');
const { generateIntelligence } = require('./gemini');

function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'https://generativelanguage.googleapis.com'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false }));

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/submissions', async (req, res) => {
    try {
      const { name, email, interests } = validateSubmission(req.body);
      const result = await run(
        'INSERT INTO acquisition_submissions(name, email, interests) VALUES (?, ?, ?)',
        [name, email, JSON.stringify(interests)],
      );

      res.status(201).json({
        submissionId: result.id,
        name,
      });
    } catch (error) {
      res.status(400).json({ error: error.message || 'Unable to save submission.' });
    }
  });

  app.get('/api/submissions', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
      const rows = await all(
        'SELECT id, name, email, interests, created_at FROM acquisition_submissions ORDER BY created_at DESC LIMIT ?',
        [limit],
      );

      res.json({
        items: rows.map((row) => ({
          ...row,
          interests: JSON.parse(row.interests),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: 'Unable to read submissions.' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { prompt, highThinking, sessionId: incomingSessionId } = validatePrompt(req.body);
      const sessionId = incomingSessionId || crypto.randomUUID();

      await run(
        `INSERT INTO chat_sessions(id, high_thinking_default, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE
         SET high_thinking_default = excluded.high_thinking_default,
             updated_at = CURRENT_TIMESTAMP`,
        [sessionId, highThinking ? 1 : 0],
      );

      const contextMessages = await all(
        `SELECT role, content
         FROM (
           SELECT id, role, content
           FROM chat_messages
           WHERE session_id = ?
           ORDER BY id DESC
           LIMIT 8
         )
         ORDER BY id ASC`,
        [sessionId],
      );

      await run(
        'INSERT INTO chat_messages(session_id, role, content, high_thinking) VALUES (?, ?, ?, ?)',
        [sessionId, 'user', prompt, highThinking ? 1 : 0],
      );

      const reply = await generateIntelligence({
        messages: contextMessages,
        prompt,
        highThinking,
      });

      await run(
        'INSERT INTO chat_messages(session_id, role, content, high_thinking) VALUES (?, ?, ?, ?)',
        [sessionId, 'assistant', reply, highThinking ? 1 : 0],
      );

      await run('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);

      res.json({
        sessionId,
        highThinking,
        response: reply,
      });
    } catch (error) {
      const isInputError = error.message?.includes('Prompt must');
      res.status(isInputError ? 400 : 502).json({
        error: error.message || 'Unable to complete intelligence request.',
      });
    }
  });

  app.get('/api/ai/history/:sessionId', async (req, res) => {
    try {
      const sessionId = String(req.params.sessionId || '').trim();

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required.' });
        return;
      }

      const messages = await all(
        'SELECT role, content, high_thinking as highThinking, created_at as createdAt FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
        [sessionId],
      );

      res.json({ sessionId, messages });
    } catch (error) {
      res.status(500).json({ error: 'Unable to load chat history.' });
    }
  });

  const staticPath = path.resolve(process.cwd(), 'kingshadp-residence');
  app.use(express.static(staticPath));

  app.use((req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  return app;
}

module.exports = {
  createApp,
  initializeDatabase,
};
