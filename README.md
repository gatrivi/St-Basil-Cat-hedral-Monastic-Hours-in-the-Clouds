# La Catedral

Liturgy of the Hours — calm reading UI for phone, TV, and desktop.

**Hard constraint:** must work on tiny phones in **landscape** (e.g. Nubia Focus 5G). See [`docs/features/Mobile-Landscape.md`](docs/features/Mobile-Landscape.md).

## Run locally

1. `npm install`
2. Optional: `GEMINI_API_KEY` in `.env.local` (falls back to built-in prayers)
3. Optional: Piper TTS at `VITE_TTS_SERVER_URL` (default `http://127.0.0.1:3001`)
4. `npm run dev`

## Docs

Agent-first, human-readable: [`docs/`](docs/) — start at [`docs/agent/MEMORY.md`](docs/agent/MEMORY.md).

Current UI version: **v1.4.5** (from `package.json` / Vite).
