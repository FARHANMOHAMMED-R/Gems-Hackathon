const STORAGE_KEY = "gems-assist-text-leveler-openai";

export function loadTextLevelerOpenAiKey(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw.trim().length >= 10) return raw.trim();
  } catch {
    /* ignore */
  }
  return "";
}

export function saveTextLevelerOpenAiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearTextLevelerOpenAiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}
