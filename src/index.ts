import "dotenv/config";
import express from "express";
import cors from "cors";

import { errorMiddleware } from "./lib/http";
import { analyzeScanRouter } from "./routes/analyzeScan";
import { differentiateContentRouter } from "./routes/differentiateContent";
import { substitutionRouter } from "./routes/substitution";
import { labsRouter } from "./routes/labs";
import { mailRouter } from "./routes/mail";
import { tokensRouter } from "./routes/tokens";

const app = express();

app.use(cors());
// Scanned image/PDF payloads are base64 and can be large — raise the limit.
app.use(express.json({ limit: "25mb" }));

// Liveness probe.
app.get("/health", (_req, res) => res.json({ ok: true, service: "gems-assist" }));

// --- Functional domains ---
app.use("/api", analyzeScanRouter); // 2. Document Vision & Notebook Analyzer
app.use("/api", differentiateContentRouter); // 3. Differentiated Content Generation
app.use("/api", substitutionRouter); // 4a. Smart Substitution
app.use("/api", labsRouter); // 4b. Lab Booking Scheduler
app.use("/api", mailRouter); // 5a. Parent Mailer
app.use("/api", tokensRouter); // 5b. Token Matrix

// 404 fallback for unknown routes.
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler (must be last).
app.use(errorMiddleware);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gems Assist backend listening on http://localhost:${PORT}`);
});

export { app };
