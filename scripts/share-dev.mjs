#!/usr/bin/env node
/**
 * Expose http://localhost:5173 (or SHARE_PORT) to the public internet via localtunnel.
 * Keep this process running; Ctrl+C stops the tunnel.
 *
 * Before running:
 *   npm run site          → full app on :5173 (recommended)
 *   — or —
 *   npm run dev           → backend :4000
 *   cd frontend && npm run dev → frontend :5173
 */

import { spawn } from "node:child_process";

const port = process.env.SHARE_PORT || "5173";

console.log("");
console.log("🔗 Gems Assist — public tunnel");
console.log(`   Forwarding to http://localhost:${port}`);
console.log("");
console.log("   Start the app first:");
console.log("     npm run site          (website + API on :5173)");
console.log("   or dev mode:");
console.log("     npm run dev           (terminal 1)");
console.log("     cd frontend && npm run dev   (terminal 2)");
console.log("");
console.log("   Press Ctrl+C to stop the tunnel.");
console.log("");

const child = spawn("npx", ["--yes", "localtunnel", "--port", port], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
