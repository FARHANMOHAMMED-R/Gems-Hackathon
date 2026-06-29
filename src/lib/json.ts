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
