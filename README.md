<p align="center">
  <img src="frontend/public/favicon.svg" width="72" alt="Gems Assist logo" />
</p>

<h1 align="center">Gems Assist</h1>

<p align="center">
  <strong>Group 3 (NEPTUNE)</strong><br />
  Farhan Mohammed Rangrej · Kailas · Roselin
</p>

<p align="center">
  AI-powered education platform for CBSE teachers — grading, differentiation, labs, parent mail, performance tracking, and a student token economy.
</p>

<p align="center">
  <a href="https://gems-class-flow.base44.app"><strong>🌐 Open app (any device) →</strong></a>
  &nbsp;·&nbsp;
  <a href="http://localhost:5173">Local dev</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/FARHANMOHAMMED-R/Gems-Hackathon">GitHub</a>
</p>

<p align="center">
  <img src="docs/screenshots/02-dashboard.png" alt="Gems Assist teacher dashboard with sidebar navigation and token leaderboard" width="920" />
</p>

---

## Universal link — works on any device

### Hosted (always on)

| | URL |
|---|---|
| **🌐 Open Gems Assist** | [**https://gems-class-flow.base44.app**](https://gems-class-flow.base44.app) |

### Your local app → public share link (full website + API)

Turn **http://localhost:5173** into a link anyone can open:

```bash
npm run share
```

This command:
1. Starts Gems Assist at **http://localhost:5173** (builds first if needed)
2. Prints a public **https://…** link that forwards to your local `:5173`

Share that link on any phone, tablet, or laptop — any network, no Wi‑Fi password.

```
══════════════════════════════════════════════════
  Local:   http://localhost:5173
  Share:   https://your-name.loca.lt
══════════════════════════════════════════════════
```

Keep the terminal open while others use the Share link. Press **Ctrl+C** to stop.

> **Note:** The hosted base44 link is frontend-only. `npm run share` runs the **full stack** locally (API + AI keys from your `.env`).

---

## Quick links

| | URL |
|---|---|
| **Universal app (recommended)** | [**https://gems-class-flow.base44.app**](https://gems-class-flow.base44.app) |
| **GitHub repository** | [github.com/FARHANMOHAMMED-R/Gems-Hackathon](https://github.com/FARHANMOHAMMED-R/Gems-Hackathon) |
| **Share local :5173 publicly** | Run `npm run share` → get https link |
| **Local website** | [http://localhost:5173](http://localhost:5173) |
| **Local API** | [http://localhost:4000](http://localhost:4000) |
| **Health check** | [http://localhost:4000/health](http://localhost:4000/health) |

---

## Clone the repo

```bash
gh repo clone FARHANMOHAMMED-R/Gems-Hackathon
# or
git clone https://github.com/FARHANMOHAMMED-R/Gems-Hackathon.git
cd Gems-Hackathon
```

---

## What it does

Gems Assist gives teachers one place to run a modern classroom:

| Feature | What you get |
|---------|----------------|
| **Class Roster** | Add, edit, import students by roll number, school ID & parent email |
| **Scan Analyzer** | OCR exam papers & notebooks (OpenAI, Gemini, Claude, PDF Guru, Tesseract) |
| **Blueprint Generator** | Upload a past paper → topic & marks breakdown |
| **Content Differentiator** | Rewrite lessons for Advanced, Standard, Visual, or Neurodivergent tracks |
| **Substitution Finder** | See which teachers are free by period |
| **Lab Booking** | Reserve rooms with double-booking protection |
| **3D Lab** | 64 embedded PhET physics simulations |
| **Teacher Chat** | Staff lounge for cross-class messages |
| **Lecture Recorder** | Record class audio, pin timestamped notes, AI timeline & summary |
| **Performance Tracker** | Enter PT1 → Half Yearly → PT2 → Final marks per subject; line graphs per student |
| **PPT Generator** | AI lesson slides (ChatGPT, Gemini, Claude) or offline template `.pptx` |
| **Parent Mailer** | Draft & send parent update emails (Resend or SMTP) |
| **Assessment Assigner** | AI-generated assessments by chapter, topic & difficulty — email to parents |
| **Token Matrix** | Award points for answering, kindness & peer support |
| **Admin Dashboard** | Manage labs, broadcast notices, monitor teachers online |

**Sign in**

| Role | How |
|------|-----|
| Teacher | Name, class (e.g. `11-A`), email |
| Admin | Passcode `farhan` |

---

## AI providers

Configure one or more keys in backend `.env` — the app picks the best available provider:

| Provider | Env variable | Used for |
|----------|--------------|----------|
| **ChatGPT** | `OPENAI_API_KEY` | Grading, PPT, mail, assessments, Whisper OCR |
| **Gemini** | `GEMINI_API_KEY` | Free-tier text, vision OCR, audio transcription |
| **Claude** | `ANTHROPIC_API_KEY` | Text, vision OCR, summaries |

Set `LLM_DEFAULT_PROVIDER=openai|gemini|claude` when multiple keys are present.

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/01-sign-in.png" alt="Teacher and admin sign-in screen" />
      <br /><sub><b>Sign in</b> — teacher or admin</sub>
    </td>
    <td width="50%">
      <img src="docs/screenshots/03-scan-analyzer.png" alt="Scan Analyzer for notebook and exam grading" />
      <br /><sub><b>Scan Analyzer</b> — exam & notebook OCR</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/04-blueprint-generator.png" alt="Exam blueprint generator with topic distribution" />
      <br /><sub><b>Blueprint Generator</b> — marks & topic map</sub>
    </td>
    <td width="50%">
      <img src="docs/screenshots/02-dashboard.png" alt="Dashboard with token leaderboard" />
      <br /><sub><b>Dashboard</b> — token leaderboard</sub>
    </td>
  </tr>
</table>

---

## Quick start (local development)

**Requirements:** Node.js 18+, npm 9+

```bash
git clone https://github.com/FARHANMOHAMMED-R/Gems-Hackathon.git
cd Gems-Hackathon

# Backend
npm install
cp .env.example .env          # add API keys for AI features (see below)
npm run prisma:generate
npm run prisma:push
npm run seed                  # optional demo data

# Terminal 1 — API
npm run dev                   # → http://localhost:4000

# Terminal 2 — website
cd frontend && npm install && npm run dev   # → http://localhost:5173
```

Open **http://localhost:5173**, sign in as a teacher, set up your class roster, and explore.

### Run as one accessible site on :5173

```bash
npm run site
# → http://localhost:5173  (same Wi‑Fi: http://YOUR-LAN-IP:5173)
```

### Turn localhost:5173 into a public share link (one command)

```bash
npm run share
```

Starts **http://localhost:5173** and prints a public **https://** URL for any device.

### Share on other devices (same Wi‑Fi only)

Vite prints a **Network** URL when the frontend starts, e.g. `http://192.168.1.42:5173`.  
Other phones and laptops on the **same Wi‑Fi** can open that link — the dev server proxies `/api` to your machine.

For access **outside your Wi‑Fi**, use the universal link: **https://gems-class-flow.base44.app**

---

## Environment variables

Copy [`.env.example`](.env.example) → `.env` at the repo root.

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | ChatGPT — grading, PPT, mail, Whisper speech-to-text |
| `GEMINI_API_KEY` | Free Gemini — OCR, transcription, PPT ([get key](https://aistudio.google.com/apikey)) |
| `ANTHROPIC_API_KEY` | Claude — text & vision OCR |
| `GURUPDF_API_KEY` | PDF Guru image-to-text for scans ([get key](https://gurupdf.com/api)) |
| `WHISPER_MODEL` | OpenAI Whisper model (default `whisper-1`) |
| `LLM_DEFAULT_PROVIDER` | Preferred AI when multiple keys set (`openai` \| `gemini` \| `claude`) |
| `RESEND_API_KEY` / SMTP | Parent Mailer & Assessment email delivery |
| `PORT` / `HOST` | Backend port (default `4000`) and bind address (`0.0.0.0` for LAN) |
| `DATABASE_URL` | SQLite path (default `file:./dev.db`) |

Frontend optional: `VITE_API_BASE` — set only when deploying without the Vite dev proxy.

---

## Architecture

```
Browser  →  React + Vite (:5173)  →  /api proxy  →  Express + Prisma (:4000)  →  SQLite + LLM
```

| Layer | Stack |
|-------|-------|
| Frontend | React · Vite · TypeScript |
| Backend | Node · Express · Prisma · SQLite |
| AI | OpenAI · Gemini · Claude · PDF Guru OCR · Whisper · local Tesseract fallback |

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/api/analyze-scan` | OCR + grade exam or notebook |
| `GET` | `/api/scan/ocr-status` | Which OCR backends are configured |
| `POST` | `/api/generate-blueprint` | Exam topic & marks blueprint |
| `POST` | `/api/differentiate-content` | Adapt lesson content |
| `GET` | `/api/substitution/check-free` | Free teachers by period |
| `POST` | `/api/labs/reserve` | Book a lab slot |
| `GET` | `/api/labs/availability` | Daily availability grid |
| `POST` | `/api/generate-mail` | Draft parent email |
| `POST` | `/api/send-mail` | Send parent email |
| `POST` | `/api/generate-assessment` | AI assessment from topics & chapters |
| `POST` | `/api/send-assessment` | Email assessment to all parents |
| `POST` | `/api/generate-ppt` | AI or template PowerPoint deck |
| `GET` | `/api/ai/providers` | Configured AI providers |
| `GET` | `/api/performance` | Term marks for a class & subject |
| `POST` | `/api/performance/marks` | Save PT1 / Half Yearly / PT2 / Final marks |
| `POST` | `/api/lecture/process` | Transcribe recording → timeline & summary |
| `GET` | `/api/lectures` | List saved lectures |
| `POST` | `/api/tokens/award` | Award student tokens |
| `GET` | `/api/tokens/leaderboard` | Class leaderboard |
| `POST` | `/api/teachers/sign-in` | Teacher session |
| `GET/POST` | `/api/students/*` | Class roster CRUD & import |
| `GET/POST` | `/api/chat/*` | Teacher staff lounge |
| `GET/POST` | `/api/notifications/*` | Admin broadcasts |
| `GET` | `/api/admin/monitor` | Online teachers & student stats |

Admin lab routes require header `X-Admin-Passcode: farhan`.

Full route implementations live in [`src/routes/`](src/routes/).

---

## Project structure

```
Gems-Hackathon/
├── docs/screenshots/       # README screenshots
├── prisma/                 # Schema & seed
├── src/
│   ├── index.ts            # Express app
│   ├── lib/                # LLM, OCR, audio, PPT, helpers
│   └── routes/             # REST endpoints
└── frontend/
    ├── src/pages/          # All app screens
    ├── src/components/     # Shared UI
    └── vite.config.ts      # Dev proxy → :4000
```

---

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| Root | `npm run share` | **Local :5173 → public https link** (one command) |
| Root | `npm run site` | Build + run full app at **http://localhost:5173** |
| Root | `npm run dev` | Backend with hot reload |
| Root | `npm run seed` | Load demo students & labs |
| `frontend/` | `npm run dev` | Website at **http://localhost:5173** |
| `frontend/` | `npm run build` | Production bundle |

Regenerate README screenshots (with dev servers running):

```bash
node scripts/capture-readme-screenshots.mjs
```

---

## Deploy

**Universal frontend (already live):** [https://gems-class-flow.base44.app](https://gems-class-flow.base44.app)

To deploy your own copy:

```bash
cd frontend
VITE_API_BASE=https://your-api.example.com npm run build
```

Serve `frontend/dist/` from any static host. Run the Express API separately and enable CORS for your frontend origin.

---

## Team — Group 3 (NEPTUNE)

| Member |
|--------|
| Farhan Mohammed Rangrej |
| Kailas |
| Roselin |

---

## License

MIT · [GEMS Hackathon](https://github.com/FARHANMOHAMMED-R/Gems-Hackathon)
