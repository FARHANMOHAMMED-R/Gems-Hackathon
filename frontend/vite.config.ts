import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Gems Assist backend runs on http://localhost:4000.
// Proxy /api and /health to it so the browser never hits a cross-origin URL.
const BACKEND = "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
    },
  },
});
