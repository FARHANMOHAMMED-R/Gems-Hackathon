#!/usr/bin/env node
/**
 * Build frontend and deploy to https://gems-class-flow.base44.app
 *
 * First time:
 *   1. npx base44 login
 *   2. npm run deploy:base44
 *
 * Requires BASE44_APP_ID (defaults to gems-class-flow app).
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PRODUCTION_API =
  process.env.VITE_API_BASE?.trim() || "https://gems-assist-api.onrender.com";

const cwd = process.cwd();
const appId = process.env.BASE44_APP_ID ?? "6a42017787b3cd36f52a2a79";
const dist = path.join(cwd, "frontend/dist/index.html");

console.log("Building frontend…");
console.log(`API target: ${PRODUCTION_API}`);
execSync("npm run build --prefix frontend", {
  cwd,
  stdio: "inherit",
  env: { ...process.env, VITE_API_BASE: PRODUCTION_API },
});

if (!existsSync(dist)) {
  console.error("Build failed — frontend/dist/index.html not found.");
  process.exit(1);
}

console.log("\nDeploying to Base44 (gems-class-flow.base44.app)…\n");
execSync(`npx --yes base44 site deploy -y --app-id ${appId}`, {
  cwd,
  stdio: "inherit",
});

console.log("\n✓ Live at https://gems-class-flow.base44.app\n");
