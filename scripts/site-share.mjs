#!/usr/bin/env node
/**
 * Start Gems Assist on http://localhost:5173 and expose it as a public share link.
 * One command — local + shareable URL for any device.
 */

import { spawn, execSync } from "node:child_process";
import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = process.env.SHARE_PORT || "5173";
const cwd = process.cwd();

let siteProcess = null;
let tunnelProcess = null;
let bannerPrinted = false;

function waitForHealth(timeoutMs = 45000) {
  return new Promise((resolve) => {
    const start = Date.now();

    function ping() {
      const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - start >= timeoutMs) resolve(false);
      else setTimeout(ping, 400);
    }

    ping();
  });
}

function ensureBuilt() {
  const needsFrontend = !existsSync(path.join(cwd, "frontend/dist/index.html"));
  const needsBackend = !existsSync(path.join(cwd, "dist/src/index.js"));

  if (needsFrontend || needsBackend) {
    console.log("Building Gems Assist (first run)…");
    execSync("npm run build:all", { cwd, stdio: "inherit" });
  }
}

function cleanup() {
  if (tunnelProcess) tunnelProcess.kill("SIGTERM");
  if (siteProcess) siteProcess.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

function printBanner(publicUrl) {
  if (bannerPrinted) return;
  bannerPrinted = true;
  console.log("");
  console.log("══════════════════════════════════════════════════");
  console.log("  Gems Assist — Group 3 (NEPTUNE)");
  console.log("──────────────────────────────────────────────────");
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Share:   ${publicUrl}`);
  console.log("══════════════════════════════════════════════════");
  console.log("");
  console.log("  Open the Share link on any phone, tablet, or laptop.");
  console.log("  Press Ctrl+C here to stop the server and tunnel.");
  console.log("");
}

async function startSiteIfNeeded() {
  const up = await waitForHealth(2500);
  if (up) {
    console.log(`✓ Already running at http://localhost:${PORT}`);
    return;
  }

  ensureBuilt();

  console.log(`\n🚀 Starting http://localhost:${PORT} …`);

  siteProcess = spawn("node", ["dist/src/index.js"], {
    cwd,
    env: {
      ...process.env,
      SERVE_FRONTEND: "true",
      PORT,
      HOST: "0.0.0.0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  siteProcess.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  siteProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  siteProcess.on("exit", (code) => {
    if (code && code !== 0 && !bannerPrinted) {
      console.error(`Server exited with code ${code}`);
      cleanup();
    }
  });

  const ready = await waitForHealth();
  if (!ready) {
    console.error(`Could not start server on http://localhost:${PORT}`);
    cleanup();
  }

  console.log(`✓ Local site ready → http://localhost:${PORT}`);
}

function startTunnel() {
  console.log("🔗 Creating public share link…\n");

  tunnelProcess = spawn("npx", ["--yes", "localtunnel", "--port", PORT], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  tunnelProcess.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const match = text.match(/https:\/\/[^\s]+/);
    if (match) printBanner(match[0]);
  });

  tunnelProcess.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  tunnelProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) cleanup();
  });
}

async function main() {
  console.log("");
  console.log("Gems Assist — localhost:5173 → public share link");
  console.log("");

  await startSiteIfNeeded();
  startTunnel();
}

main().catch((err) => {
  console.error(err);
  cleanup();
});
