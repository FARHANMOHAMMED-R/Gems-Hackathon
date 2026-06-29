import "dotenv/config";
import path from "path";
import { existsSync } from "fs";
import express from "express";
import cors from "cors";

import { errorMiddleware } from "./lib/http";
import { getLanIPv4 } from "./lib/lanAddress";
import { analyzeScanRouter } from "./routes/analyzeScan";
import { blueprintRouter } from "./routes/blueprint";
import { differentiateContentRouter } from "./routes/differentiateContent";
import { substitutionRouter } from "./routes/substitution";
import { labsRouter } from "./routes/labs";
import { mailRouter } from "./routes/mail";
import { tokensRouter } from "./routes/tokens";
import { teachersRouter } from "./routes/teachers";
import { studentsRouter } from "./routes/students";
import { teacherChatRouter } from "./routes/teacherChat";
import { notificationsRouter } from "./routes/notifications";
import { adminMonitorRouter } from "./routes/adminMonitor";
import { assessmentRouter } from "./routes/assessment";
import { pptRouter, aiRouter } from "./routes/ppt";
import { performanceRouter } from "./routes/performance";
import { lectureRouter } from "./routes/lecture";

const app = express();

function resolveFrontendDist(): string | null {
  const dist = path.resolve(process.cwd(), "frontend/dist");
  return existsSync(path.join(dist, "index.html")) ? dist : null;
}

const serveWebsite = process.env.SERVE_FRONTEND === "true";
const frontendDist = serveWebsite ? resolveFrontendDist() : null;

if (serveWebsite && !frontendDist) {
  // eslint-disable-next-line no-console
  console.warn(
    "SERVE_FRONTEND=true but frontend/dist not found. Run: cd frontend && npm run build",
  );
}

app.use(cors());
// Scanned image/PDF payloads are base64 and can be large — raise the limit.
app.use(express.json({ limit: "25mb" }));

// Liveness probe.
app.get("/health", (_req, res) => res.json({ ok: true, service: "gems-assist" }));

// API info root — only when not serving the React website from this process.
if (!frontendDist) {
  app.get("/", (_req, res) => {
    res.json({
      service: "gems-assist-api",
      message: "This is the backend API. Open the website instead.",
      website: {
        local: "http://localhost:5173",
        live: "https://gems-class-flow.base44.app",
        share: "Run npm run share at repo root for a public https link → localhost:5173",
        github: "https://github.com/FARHANMOHAMMED-R/Gems-Hackathon",
      },
      health: "/health",
      docs: "https://github.com/FARHANMOHAMMED-R/Gems-Hackathon#api-reference",
    });
  });
}

// --- Functional domains ---
app.use("/api", analyzeScanRouter); // 2. Document Vision & Notebook Analyzer
app.use("/api", blueprintRouter); // 2b. Exam Blueprint Generator
app.use("/api", differentiateContentRouter); // 3. Differentiated Content Generation
app.use("/api", substitutionRouter); // 4a. Smart Substitution
app.use("/api", labsRouter); // 4b. Lab Booking Scheduler
app.use("/api", mailRouter); // 5a. Parent Mailer
app.use("/api", assessmentRouter); // 5c. Assessment Assigner
app.use("/api", pptRouter); // 5d. PPT Generator
app.use("/api", aiRouter); // AI provider status
app.use("/api", performanceRouter); // 5e. Performance tracker
app.use("/api", lectureRouter); // 5f. Lecture recorder
app.use("/api", tokensRouter); // 5b. Token Matrix
app.use("/api", teachersRouter); // Teacher sign-in
app.use("/api", studentsRouter); // Class roster & students
app.use("/api", teacherChatRouter); // Teacher staff chat
app.use("/api", notificationsRouter); // Admin → teacher notifications
app.use("/api", adminMonitorRouter); // Admin monitoring dashboard

// Serve built React app (website + API on one port, e.g. :5173).
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// 404 fallback for unknown routes.
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler (must be last).
app.use(errorMiddleware);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  const lan = getLanIPv4();
  if (frontendDist) {
    // eslint-disable-next-line no-console
    console.log(`Gems Assist website + API → http://localhost:${PORT}`);
    if (lan) {
      // eslint-disable-next-line no-console
      console.log(`  Network (same Wi‑Fi): http://${lan}:${PORT}`);
    }
    // eslint-disable-next-line no-console
    console.log(`  Public internet: npm run share (in another terminal)`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Gems Assist backend listening on http://localhost:${PORT}`);
    if (lan) {
      // eslint-disable-next-line no-console
      console.log(`  Network:  http://${lan}:${PORT}`);
    }
  }
});

export { app };
