# luxuryy

KingShadP Residence site with server-side intelligence and persistence.

## What was added

- Express backend to serve the static site and API routes.
- SQLite database for:
  - acquisition submissions
  - AI chat sessions
  - AI chat messages
- Gemini integration from the server (API key never exposed to frontend).
- High-thinking mode toggle in the UI and API.

## Environment

Copy `.env.example` to `.env` and set values:

- `PORT` - server port (default `3000`)
- `DB_PATH` - sqlite file path (default `./data/residence.db`)
- `GEMINI_API_KEY` - required Gemini API key
- `GEMINI_MODEL` - Gemini model name (default `gemini-2.0-flash`)
- `GEMINI_HIGH_THINKING_BUDGET` - thinking budget used when high-thinking is enabled

## Run

```bash
npm install
npm run start
```

Open: `http://localhost:3000`

## Scripts

- `npm run lint` - syntax checks
- `npm run build` - syntax checks (no transpile step required)
- `npm run test` - node test suite

## API

- `GET /api/health`
- `POST /api/submissions`
  - body: `{ "name": "...", "email": "...", "interests": ["..."] }`
- `GET /api/submissions?limit=20`
- `POST /api/ai/chat`
  - body: `{ "prompt": "...", "highThinking": true|false, "sessionId": "optional" }`
- `GET /api/ai/history/:sessionId`

## Notes

- Rate limiting is enabled on `/api/*`.
- Input validation and sanitization are applied to submission and AI payloads.
