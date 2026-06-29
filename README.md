# Gems Assist

**Gems Assist** is an education platform for AI-powered grading, differentiated content, smart teacher substitution, lab booking, parent communication, and a student token economy.

## Links

| Resource | URL |
|----------|-----|
| **Live Website (App)** | [**https://gems-class-flow.base44.app**](https://gems-class-flow.base44.app) |
| **GitHub Repository** | [**github.com/FARHANMOHAMMED-R/Gems-Hackathon**](https://github.com/FARHANMOHAMMED-R/Gems-Hackathon) |
| **Local Website** | [**http://localhost:5173**](http://localhost:5173) — run `cd frontend && npm run dev` |
| **Local API** | [http://localhost:4000](http://localhost:4000) — API only (use `/health` to test) |
| **Health Check** | [http://localhost:4000/health](http://localhost:4000/health) |

> **Tip:** Add the live website URL to your GitHub repo **About → Website** field: `https://gems-class-flow.base44.app`

---

## Architecture

| Layer | Stack | Role |
|-------|-------|------|
| **Backend** | Node.js · TypeScript · Express · Prisma · SQLite | REST API, persistence, LLM orchestration |
| **Frontend** | React · Vite · TypeScript (`frontend/`) | Responsive UI for all six platform domains |

The frontend talks to the backend over HTTP. In development, the Vite dev server proxies `/api` and `/health` to `http://localhost:4000`, so the browser stays same-origin.

```
┌─────────────────┐     /api, /health      ┌──────────────────────────┐
│  React + Vite   │ ─────────────────────► │  Express API  (:4000)  │
│  (:5173)        │                        │  Prisma + SQLite         │
└─────────────────┘                        └──────────┬───────────────┘
                                                      │
                                                      ▼
                                           OpenAI-compatible LLM
                                           (grading, OCR, mail, content)
```

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/FARHANMOHAMMED-R/Gems-Hackathon.git
cd Gems-Hackathon

# 2. Install backend dependencies
npm install

# 3. Configure environment (add OPENAI_API_KEY for AI features)
cp .env.example .env

# 4. Database setup
npm run prisma:generate
npm run prisma:push

# 5. (Optional) Seed demo data — CBSE Class 11 students, teachers, labs
npm run seed

# 6. Start the backend (terminal 1)
npm run dev          # http://localhost:4000

# 7. Start the frontend (terminal 2)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Health check: `GET http://localhost:4000/health`

> **AI endpoints** return `503 LLM_NOT_CONFIGURED` until `OPENAI_API_KEY` is set in `.env`. Deterministic endpoints (substitution, labs, tokens) work without a key.

---

## Environment variables

Copy `.env.example` to `.env` at the repo root.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | Backend HTTP port |
| `DATABASE_URL` | `file:./dev.db` | Prisma datasource (SQLite locally; swap for Postgres/MySQL in production) |
| `OPENAI_API_KEY` | *(empty)* | LLM authentication — **required for AI endpoints** |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible gateway (OpenAI, Azure, etc.) |
| `LLM_TEXT_MODEL` | `gpt-4o` | Text model for grading, differentiation, and mail drafting |
| `LLM_VISION_MODEL` | `gpt-4o` | Multimodal model for scan OCR |

**Frontend (optional):** set `VITE_API_BASE` to point at a non-proxied backend origin (e.g. `http://localhost:4000`) when deploying without the Vite dev proxy. Defaults to `""` (relative URLs via proxy).

---

## API endpoints

| Domain | Method | Path | Description |
|--------|--------|------|-------------|
| Health | `GET` | `/health` | Liveness probe |
| Scan Analyzer | `POST` | `/api/analyze-scan` | Vision OCR + CBSE examiner grading (exam or notebook) |
| Content Differentiator | `POST` | `/api/differentiate-content` | Rewrite lesson for a learner track (markdown) |
| Substitution Finder | `GET` | `/api/substitution/check-free` | Free teachers by period (`?period=&department=`) |
| Lab Booking | `POST` | `/api/labs/reserve` | Reserve a lab slot (409 on double-booking) |
| Lab Booking | `GET` | `/api/labs/availability` | Availability grid (`?date=YYYY-MM-DD`) |
| Lab Booking | `GET` | `/api/labs/reservations` | List all reservations (`?date=` optional); requires `X-Admin-Passcode` header |
| Lab Booking | `PATCH` | `/api/labs/reservations/:id` | Update reservation; requires `X-Admin-Passcode` header |
| Lab Booking | `DELETE` | `/api/labs/reservations/:id` | Delete/cancel reservation; requires `X-Admin-Passcode` header |
| Parent Mailer | `POST` | `/api/generate-mail` | Draft compassionate parent update email |
| Token Matrix | `POST` | `/api/tokens/award` | Award tokens (`answering` +1, `kindness` +5, `peer_support` +3) |
| Token Matrix | `GET` | `/api/tokens/leaderboard` | Ranked student leaderboard |
| Teacher Sign-In | `POST` | `/api/teachers/sign-in` | Upsert teacher profile by email |
| Teacher Sign-In | `GET` | `/api/teachers/me` | Restore session (`?email=`) |

**Admin lab APIs** require header `X-Admin-Passcode: farhan` (hackathon MVP — passcode is also validated client-side on sign-in).

### Admin lab API examples

```bash
# List all reservations
curl -s -H "X-Admin-Passcode: farhan" http://localhost:4000/api/labs/reservations

# Filter by date
curl -s -H "X-Admin-Passcode: farhan" "http://localhost:4000/api/labs/reservations?date=2026-06-29"

# Update a reservation (replace RESERVATION_ID)
curl -s -X PATCH -H "Content-Type: application/json" -H "X-Admin-Passcode: farhan" \
  -d '{"roomName":"Physics Lab 2","status":"Occupied"}' \
  http://localhost:4000/api/labs/reservations/RESERVATION_ID

# Delete a reservation
curl -s -X DELETE -H "X-Admin-Passcode: farhan" \
  http://localhost:4000/api/labs/reservations/RESERVATION_ID
```

System prompts live in [`src/lib/prompts.ts`](src/lib/prompts.ts). See the existing route files under `src/routes/` for full request/response schemas.

---

## Frontend screens

| Screen | Features |
|--------|----------|
| **Sign-In** | Teacher (name, class, email) or Admin (passcode `farhan`) |
| **Admin Dashboard** | Manage all lab reservations — view, edit, delete, add |
| **Dashboard** | Token leaderboard, award tokens by reason |
| **Scan Analyzer** | Upload scanned pages or paste text; exam vs. notebook modes |
| **Content Differentiator** | Adapt lessons (Advanced, Standard, Simplified Visual, Neurodivergent) |
| **Substitution Finder** | Query free teachers by period and department |
| **Lab Booking** | Reserve rooms and view daily availability |
| **Parent Mailer** | Generate and copy parent update emails |

Each screen includes loading, empty, and error states, plus toast notifications. The sidebar shows live backend health.

### Sign-in flows

| Role | How to sign in | After login |
|------|----------------|-------------|
| **Teacher** | Select **Teacher** tab → name, class, email | Teacher tools (dashboard, labs, etc.) |
| **Admin** | Select **Admin** tab → passcode `farhan` | **Admin Dashboard** + all teacher tools |

Sign out clears the session for either role.

---

## Project structure

```
Gems-Hackathon/
├── .env.example              # Backend environment template
├── package.json              # Backend scripts & dependencies
├── prisma/
│   ├── schema.prisma         # StudentProfile, GradingRecord, LabReservation, TeacherAvailability
│   └── seed.ts               # Demo data seeder
├── src/
│   ├── index.ts              # Express app + route wiring
│   ├── lib/                  # prisma, llm, prompts, json, http helpers
│   └── routes/               # analyzeScan, differentiateContent, substitution,
│                             # labs, mail, tokens, teachers
└── frontend/
    ├── package.json
    ├── vite.config.ts        # Dev proxy: /api & /health → :4000
    └── src/
        ├── App.tsx           # Sidebar nav + screen routing
        ├── api/              # Typed fetch client
        ├── components/       # Toast, shared UI primitives
        ├── lib/              # authSession (teacher + admin roles)
        └── pages/            # SignIn, AdminDashboard, Dashboard, ScanAnalyzer,
                              # ContentDifferentiator, SubstitutionFinder, LabBooking, ParentMailer
```

---

## Development scripts

### Backend (repo root)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Hot-reload via `tsx watch` |
| Build | `npm run build` | Compile TypeScript to `dist/` |
| Start | `npm start` | Run compiled `dist/index.js` |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Prisma generate | `npm run prisma:generate` | Regenerate Prisma client |
| Prisma push | `npm run prisma:push` | Sync schema to SQLite |
| Prisma migrate | `npm run prisma:migrate` | Create migration (`init`) |
| Seed | `npm run seed` | Load demo students, teachers, labs |

### Frontend (`frontend/`)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Vite on `:5173`, proxies API to `:4000` |
| Build | `npm run build` | Typecheck + production bundle |
| Preview | `npm run preview` | Serve production build locally |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |

---

## Deploying the frontend

The frontend is a **static SPA** built with Vite. The Express API must be hosted separately (Railway, Render, Fly.io, a VPS, etc.).

### Build

```bash
cd frontend
npm install
cp .env.example .env   # optional — set VITE_API_BASE for production
npm run build          # output → frontend/dist/
```

Set `VITE_API_BASE` to your deployed API origin (e.g. `https://api.example.com`) **at build time** so the bundle points at the correct backend. Leave it empty only if you put a reverse proxy in front of both the static site and `/api`.

Serve the contents of `frontend/dist/` from any static host (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront, nginx, etc.).

### Vercel / Netlify

- **Vercel:** set root directory to `frontend`, build command `npm run build`, output `dist`. `frontend/vercel.json` includes SPA fallback rewrites.
- **Netlify:** use `frontend/netlify.toml` (build + SPA redirect) or point the site at `frontend/` with publish directory `dist`.

Ensure the backend allows CORS from your frontend origin if they are on different domains.

---

## Data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). SQLite is the default for zero-config local dev; enum-like fields are stored as `String` and JSON fields as serialized strings (handled by [`src/lib/json.ts`](src/lib/json.ts)).

| Model | Purpose |
|-------|---------|
| `StudentProfile` | Learner profile, token balance, adaptive preference |
| `GradingRecord` | AI-graded exam or notebook artifacts |
| `LabReservation` | Lab room slots with unique `(room, date, period)` constraint |
| `TeacherAvailability` | Per-teacher 7-period free/busy status |
| `TeacherProfile` | Signed-in teacher (name, class, email) |

---

## License

MIT
