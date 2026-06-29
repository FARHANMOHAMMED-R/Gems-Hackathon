# Gems Assist — Frontend

React + Vite website for [**Gems Assist**](../README.md).

## Run locally

```bash
# Terminal 1 — from repo root
npm run dev

# Terminal 2 — from this folder
npm install && npm run dev
```

Open **[http://localhost:5173](http://localhost:5173)**.

The Vite dev server proxies `/api` and `/health` to `http://localhost:4000`.

## Docs

Full setup, screenshots, features, and API reference → **[root README](../README.md)**.

## Build

```bash
npm run build      # → dist/
npm run typecheck
```

Set `VITE_API_BASE` at build time when the API is on a different origin.
