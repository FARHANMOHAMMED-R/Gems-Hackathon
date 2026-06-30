const STORAGE_KEY = "gems-assist-ppt-skywork-key";

export function loadSkyworkPptApiKey(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw.trim().length >= 10) return raw.trim();
  } catch {
    /* ignore */
  }
  return "";
}

export function saveSkyworkPptApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearSkyworkPptApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const SKYWORK_PPT_KEY_URL = "https://skywork.ai/?openApiKeySetting=1";

export const SKYWORK_PPT_PRODUCT_URL =
  "https://skywork.ai/agent/en/ppt-generator-ai-presentation-maker-2009530307591712768";
