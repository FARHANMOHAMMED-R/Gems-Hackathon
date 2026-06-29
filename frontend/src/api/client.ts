import type {
  AnalyzeScanRequest,
  AnalyzeScanResponse,
  AvailabilityResponse,
  AwardReason,
  AwardResponse,
  DifferentiateRequest,
  DifferentiateResponse,
  GenerateMailRequest,
  GenerateMailResponse,
  HealthResponse,
  LeaderboardResponse,
  ReserveRequest,
  ReserveResponse,
  SubstitutionResponse,
} from "./types";

// Single source of truth for the API base. The Vite dev proxy (vite.config.ts)
// forwards /api and /health to http://localhost:4000, so a relative base keeps
// the browser same-origin and avoids CORS entirely. Override at build time with
// VITE_API_BASE if the frontend is ever served separately from the backend.
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/**
 * Rich error that preserves the HTTP status and the backend's machine `code`
 * (e.g. "LLM_NOT_CONFIGURED", "DOUBLE_BOOKING") so callers can branch on it.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the backend has no OPENAI_API_KEY configured. */
  get isLlmNotConfigured(): boolean {
    return this.code === "LLM_NOT_CONFIGURED";
  }

  /** True when a lab slot is already taken. */
  get isDoubleBooking(): boolean {
    return this.code === "DOUBLE_BOOKING";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    // Network-level failure (backend down, proxy refused, etc).
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      0,
      "Could not reach the backend. Make sure it is running on http://localhost:4000.",
    );
  }

  // Some endpoints (health) always return JSON; guard for empty/non-JSON too.
  const text = await res.text();
  const data = text ? safeParse(text) : undefined;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : undefined) ?? `Request failed with status ${res.status}`;
    const code =
      data && typeof data === "object" && "code" in data
        ? (data as { code?: string }).code
        : undefined;
    throw new ApiError(res.status, message, code);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- Typed endpoint wrappers ---
export const api = {
  health: () => request<HealthResponse>("/health"),

  // Tokens
  getLeaderboard: () => request<LeaderboardResponse>("/api/tokens/leaderboard"),
  awardToken: (studentId: string, reason: AwardReason) =>
    request<AwardResponse>("/api/tokens/award", {
      method: "POST",
      body: { studentId, reason },
    }),

  // Scan analysis
  analyzeScan: (body: AnalyzeScanRequest, signal?: AbortSignal) =>
    request<AnalyzeScanResponse>("/api/analyze-scan", {
      method: "POST",
      body,
      signal,
    }),

  // Content differentiation
  differentiate: (body: DifferentiateRequest, signal?: AbortSignal) =>
    request<DifferentiateResponse>("/api/differentiate-content", {
      method: "POST",
      body,
      signal,
    }),

  // Substitution
  checkFree: (period: number, department?: string) => {
    const params = new URLSearchParams({ period: String(period) });
    if (department) params.set("department", department);
    return request<SubstitutionResponse>(
      `/api/substitution/check-free?${params.toString()}`,
    );
  },

  // Labs
  reserveLab: (body: ReserveRequest) =>
    request<ReserveResponse>("/api/labs/reserve", {
      method: "POST",
      body,
    }),
  labAvailability: (date: string) =>
    request<AvailabilityResponse>(
      `/api/labs/availability?date=${encodeURIComponent(date)}`,
    ),

  // Parent mailer
  generateMail: (body: GenerateMailRequest, signal?: AbortSignal) =>
    request<GenerateMailResponse>("/api/generate-mail", {
      method: "POST",
      body,
      signal,
    }),
};
