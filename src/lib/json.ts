/**
 * JSON column helpers.
 *
 * The local SQLite connector stores JSON/array-shaped fields as serialized
 * strings. These helpers centralize (de)serialization so route code stays
 * clean and a future move to Postgres `Json` columns only touches this file.
 */

/** Serialize a value for storage in a String-backed JSON column. */
export function toJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Parse a String-backed JSON column, returning `fallback` on null/invalid. */
export function fromJsonColumn<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Parse model JSON output, tolerating markdown code fences. */
export function safeParseJSON<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Model did not return valid JSON.");
  }
}
