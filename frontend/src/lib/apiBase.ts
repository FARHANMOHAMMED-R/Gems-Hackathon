/**
 * API origin for fetch calls.
 * - Local dev: "" → Vite proxies /api and /health to :4000
 * - Base44 / static host: VITE_API_BASE or PRODUCTION_API_URL
 */
export const PRODUCTION_API_URL = "https://gems-assist-api.onrender.com";

export function resolveApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim();
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "";
    if (host.endsWith(".base44.app") || host.endsWith(".loca.lt")) {
      return PRODUCTION_API_URL;
    }
  }

  return "";
}

/** Extra headers for tunnel hosts that show an interstitial page. */
export function apiFetchHeaders(): Record<string, string> {
  const base = resolveApiBase();
  if (base.includes("loca.lt")) {
    return { "Bypass-Tunnel-Reminder": "true" };
  }
  return {};
}
