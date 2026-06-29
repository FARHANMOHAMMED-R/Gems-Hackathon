# Gems Assist — Frontend

A React + Vite + TypeScript web app for the **Gems Assist** education platform.
It talks to the existing Node/Express/Prisma backend and surfaces every domain
through a clean, responsive UI.

## Links

- **GitHub Repository:** https://github.com/FARHANMOHAMMED-R/Gems-Hackathon
- **Local Website (Frontend):** http://localhost:5173 (run `cd frontend && npm run dev`)
- **Local API (Backend):** http://localhost:4000
- **Health Check:** http://localhost:4000/health

> **Public live URL:** Deploy `frontend/dist` to Vercel or Netlify. See the root [README](../README.md#deploying-the-frontend) for build and hosting steps.

## Prerequisites

The backend must be running on **http://localhost:4000**. From the repo root:

```bash
npm install
npm run prisma:generate
npm run prisma:push   # create the SQLite DB
npm run seed          # optional: demo students, teachers, reservations
npm run dev           # starts the backend on :4000
```

> AI features (Scan Analyzer, Content Differentiator, Parent Mailer) require an
> `OPENAI_API_KEY` in the backend `.env`. Without it the backend returns
> `503 LLM_NOT_CONFIGURED` and the UI shows a friendly "not configured" message.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the printed URL (default **http://localhost:5173**).

The Vite dev server proxies `/api` and `/health` to `http://localhost:4000`, so
the browser stays same-origin and there are no CORS issues.

## Build / typecheck

```bash
cd frontend
npm run build      # tsc -b && vite build  (type-checks + production bundle)
npm run typecheck  # tsc --noEmit only
npm run preview    # preview the production build
```

## Features

| Section | Backend endpoint(s) |
| --- | --- |
| **Dashboard / Leaderboard** | `GET /api/tokens/leaderboard`, `POST /api/tokens/award` |
| **Scan Analyzer** | `POST /api/analyze-scan` (text or base64 images) |
| **Content Differentiator** | `POST /api/differentiate-content` (renders markdown) |
| **Substitution Finder** | `GET /api/substitution/check-free` |
| **Lab Booking** | `POST /api/labs/reserve`, `GET /api/labs/availability` |
| **Parent Mailer** | `POST /api/generate-mail` (with copy button) |

Every section has loading, empty, and error states, plus toast notifications.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE` | `""` (relative, uses dev proxy) | Point the app at a backend on a different origin (e.g. `http://localhost:4000`) for a non-proxied deploy. |

## Project structure

```
frontend/
├── index.html
├── package.json
├── tsconfig*.json
├── vite.config.ts          # dev proxy: /api & /health -> :4000
├── public/favicon.svg
└── src/
    ├── main.tsx            # entry + ToastProvider
    ├── App.tsx             # sidebar nav, backend health, routing
    ├── index.css           # design system (cards, forms, toasts, etc.)
    ├── api/
    │   ├── client.ts       # centralized fetch wrapper + typed endpoints
    │   └── types.ts        # request/response types
    ├── components/
    │   ├── Toast.tsx       # toast context + stack
    │   └── ui.tsx          # Card, Spinner, EmptyState, ErrorNote, Field
    └── pages/
        ├── Dashboard.tsx
        ├── ScanAnalyzer.tsx
        ├── ContentDifferentiator.tsx
        ├── SubstitutionFinder.tsx
        ├── LabBooking.tsx
        └── ParentMailer.tsx
```
