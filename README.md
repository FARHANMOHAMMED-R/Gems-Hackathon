# Gems Assist — Backend

Production-grade backend for the **Gems Assist** education platform. It powers AI
grading, content differentiation, smart teacher substitution, lab booking, a
parent mailer, and a student token economy.

**Stack:** Node.js · TypeScript · Express · Prisma (SQLite by default) · OpenAI-compatible LLM.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment (then add your OPENAI_API_KEY)
cp .env.example .env

# 3. Create the database + generate the client
npm run prisma:generate
npm run prisma:push

# 4. (optional) Seed demo data — CBSE Class 11 students, teachers, labs
npm run seed

# 5. Run
npm run dev        # hot-reload dev server
# or
npm run build && npm start
```

Server boots on `http://localhost:4000`. Health check: `GET /health`.

> The AI endpoints return `503 LLM_NOT_CONFIGURED` until `OPENAI_API_KEY` is set —
> the deterministic endpoints (substitution, labs, tokens) work without a key.

---

## Data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma). SQLite is the default
for zero-config local dev; it has no native `enum`/`Json` columns, so enum-like
fields are `String` and JSON/array fields are stored as serialized JSON strings
(handled by [`src/lib/json.ts`](src/lib/json.ts)). On Postgres/MySQL you can
promote these back to native enums and `Json`.

| Model | Key fields |
|-------|-----------|
| `StudentProfile` | `name`, `grade`, `section`, `total_tokens`, `adaptive_preference_profile` |
| `GradingRecord` | `student_id`, `type` (`Exam`\|`Notebook`), `raw_scanned_text`, `scores`, `ai_feedback_text`, `date_timestamp` |
| `LabReservation` | `room_name`, `period_number`, `date`, `reserved_by_teacher_id`, `status` (`Free`\|`Occupied`) — **unique** on `(room, date, period)` |
| `TeacherAvailability` | `teacher_name`, `department`, `current_period_free_status` (7-bool array, periods 1–7) |

---

## API reference

All system prompts live verbatim in [`src/lib/prompts.ts`](src/lib/prompts.ts).
A shared grounding guardrail (no hallucination, no boilerplate) is appended to
every LLM call, with low temperature for deterministic output.

### 2. Document Vision & Notebook Analyzer — `POST /api/analyze-scan`
Two-stage pipeline: **Vision OCR → Senior CBSE Examiner**.

```jsonc
// Request (either images OR rawScannedText)
{
  "mode": "Exam Paper",           // or "Notebook"
  "studentId": "…",               // optional — persists a GradingRecord
  "markingScheme": "…",           // used in Exam Paper mode
  "images": ["data:image/png;base64,…"],  // base64 scanned pages
  "rawScannedText": "…"           // skip OCR if text already extracted
}
// Response
{ "score_breakdown": {…}, "constructive_feedback": "…", "concept_gaps": [...], "rawScannedText": "…", "recordId": "…" }
```
Notebook mode scores **Handwriting / Creativity / Content** (5 each).

### 3. Differentiated Content — `POST /api/differentiate-content`
Rewrites a lesson for a learner track. Returns markdown.

```jsonc
{ "content": "…lesson text…", "target": "Advanced" }
// target ∈ "Advanced" | "Standard" | "Simplified Visual" | "Neurodivergent"
```

### 4a. Smart Substitution — `GET /api/substitution/check-free`
Returns teachers free in a period, department-matched first.

```
GET /api/substitution/check-free?period=3&department=Physics
```

### 4b. Lab Booking — `POST /api/labs/reserve`
Strict double-booking prevention via a DB unique constraint → `409 DOUBLE_BOOKING`.

```jsonc
{ "roomName": "Physics Lab 1", "date": "2026-07-01", "periodNumber": 4, "reservedByTeacherId": "…" }
```
Also: `GET /api/labs/availability?date=YYYY-MM-DD`.

### 5a. Parent Mailer — `POST /api/generate-mail`
Aggregates recent `GradingRecord`s + token balance, drafts a compassionate
parent email.

```jsonc
{ "studentId": "…", "recentLimit": 5 }
```

### 5b. Token Matrix — `POST /api/tokens/award`
Atomic increment + recomputed leaderboard. Rewards: `answering` +1, `kindness`
+5, `peer_support` +3.

```jsonc
{ "studentId": "…", "reason": "kindness" }
```
Also: `GET /api/tokens/leaderboard`.

---

## Project layout

```
prisma/
  schema.prisma        # data models
  seed.ts              # demo data
src/
  index.ts             # express app + route wiring
  lib/
    prisma.ts          # shared Prisma client
    llm.ts             # OpenAI-compatible client (text + vision, JSON mode)
    prompts.ts         # verbatim system prompts
    json.ts            # JSON-column (de)serialization
    http.ts            # async wrapper + central error handling
  routes/
    analyzeScan.ts          # /api/analyze-scan
    differentiateContent.ts # /api/differentiate-content
    substitution.ts         # /api/substitution/check-free
    labs.ts                 # /api/labs/reserve, /availability
    mail.ts                 # /api/generate-mail
    tokens.ts               # /api/tokens/award, /leaderboard
```

## Environment

| Var | Purpose |
|-----|---------|
| `PORT` | HTTP port (default 4000) |
| `DATABASE_URL` | Prisma datasource (default `file:./dev.db`) |
| `OPENAI_API_KEY` | LLM auth — required for AI endpoints |
| `OPENAI_BASE_URL` | OpenAI-compatible gateway URL |
| `LLM_TEXT_MODEL` | Model for grading/mail/differentiation |
| `LLM_VISION_MODEL` | Multimodal model for scan OCR |
