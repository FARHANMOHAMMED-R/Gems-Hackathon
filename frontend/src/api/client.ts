import { ADMIN_PASSCODE } from "../lib/authSession";
import type {
  AnalyzeScanRequest,
  AnalyzeScanResponse,
  ScanOcrStatusResponse,
  GenerateBlueprintRequest,
  GenerateBlueprintResponse,
  AvailabilityResponse,
  AwardReason,
  AwardResponse,
  DeleteLabReservationResponse,
  DifferentiateRequest,
  DifferentiateResponse,
  GenerateMailRequest,
  GenerateMailResponse,
  GenerateMailBatchRequest,
  GenerateMailBatchResponse,
  SendMailRequest,
  SendMailResponse,
  SendMailBatchRequest,
  SendMailBatchResponse,
  MailStatusResponse,
  GenerateAssessmentRequest,
  GenerateAssessmentResponse,
  SendAssessmentRequest,
  SendAssessmentResponse,
  AssessmentRecipientsResponse,
  HealthResponse,
  LeaderboardResponse,
  ReservationsListResponse,
  ReserveRequest,
  ReserveResponse,
  SubstitutionResponse,
  TeacherProfile,
  TeacherSignInRequest,
  TeachersListResponse,
  ChatMessagesResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  NotificationsResponse,
  CreateNotificationRequest,
  AdminNotification,
  AdminMonitorResponse,
  UpdateLabReservationRequest,
  UpdateLabReservationResponse,
  RosterStatusResponse,
  StudentsListResponse,
  CreateRosterRequest,
  CreateRosterResponse,
  ParseRosterTextRequest,
  ParseRosterTextResponse,
  AddStudentRequest,
  StudentMutationResponse,
  DeleteStudentResponse,
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

  /** True when email sending is not configured on the backend. */
  get isMailNotConfigured(): boolean {
    return this.code === "MAIL_NOT_CONFIGURED";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
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
    const serverMessage =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : undefined;
    let message =
      serverMessage ?? `Request failed with status ${res.status}`;
    if (res.status >= 500) {
      message = serverMessage
        ? `Server error (${res.status}): ${serverMessage}. Check that the backend is running on http://localhost:4000 (npm run dev).`
        : `Server error (${res.status}). The backend may be offline — start it with npm run dev on http://localhost:4000.`;
    }
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
  getLeaderboard: (classManaged?: string) => {
    const qs = classManaged
      ? `?classManaged=${encodeURIComponent(classManaged)}`
      : "";
    return request<LeaderboardResponse>(`/api/tokens/leaderboard${qs}`);
  },
  awardToken: (studentId: string, reason: AwardReason) =>
    request<AwardResponse>("/api/tokens/award", {
      method: "POST",
      body: { studentId, reason },
    }),
  awardPoints: (studentId: string, points: number) =>
    request<AwardResponse>("/api/tokens/award", {
      method: "POST",
      body: { studentId, points },
    }),

  // Scan analysis
  analyzeScan: (body: AnalyzeScanRequest, signal?: AbortSignal) =>
    request<AnalyzeScanResponse>("/api/analyze-scan", {
      method: "POST",
      body,
      signal,
    }),
  getScanOcrStatus: () => request<ScanOcrStatusResponse>("/api/scan/ocr-status"),

  generateBlueprint: (body: GenerateBlueprintRequest, signal?: AbortSignal) =>
    request<GenerateBlueprintResponse>("/api/generate-blueprint", {
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
  listLabReservations: (date?: string) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return request<ReservationsListResponse>(`/api/labs/reservations${qs}`, {
      headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
    });
  },
  updateLabReservation: (id: string, body: UpdateLabReservationRequest) =>
    request<UpdateLabReservationResponse>(`/api/labs/reservations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
      headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
    }),
  deleteLabReservation: (id: string) =>
    request<DeleteLabReservationResponse>(
      `/api/labs/reservations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
      },
    ),

  // Parent mailer
  generateMail: (body: GenerateMailRequest, signal?: AbortSignal) =>
    request<GenerateMailResponse>("/api/generate-mail", {
      method: "POST",
      body,
      signal,
    }),
  generateMailBatch: (body: GenerateMailBatchRequest, signal?: AbortSignal) =>
    request<GenerateMailBatchResponse>("/api/generate-mail/batch", {
      method: "POST",
      body,
      signal,
    }),
  getMailStatus: () => request<MailStatusResponse>("/api/mail/status"),
  sendMail: (body: SendMailRequest, signal?: AbortSignal) =>
    request<SendMailResponse>("/api/send-mail", { method: "POST", body, signal }),
  sendMailBatch: (body: SendMailBatchRequest, signal?: AbortSignal) =>
    request<SendMailBatchResponse>("/api/send-mail/batch", {
      method: "POST",
      body,
      signal,
    }),

  // Assessment assigner
  generateAssessment: (body: GenerateAssessmentRequest, signal?: AbortSignal) =>
    request<GenerateAssessmentResponse>("/api/generate-assessment", {
      method: "POST",
      body,
      signal,
    }),
  getAssessmentRecipients: (classManaged: string) =>
    request<AssessmentRecipientsResponse>(
      `/api/assessment/recipients?classManaged=${encodeURIComponent(classManaged)}`,
    ),
  sendAssessment: (body: SendAssessmentRequest, signal?: AbortSignal) =>
    request<SendAssessmentResponse>("/api/send-assessment", {
      method: "POST",
      body,
      signal,
    }),

  // Students / roster
  getRosterStatus: (classManaged: string) =>
    request<RosterStatusResponse>(
      `/api/students/roster-status?classManaged=${encodeURIComponent(classManaged)}`,
    ),
  listStudents: (classManaged: string) =>
    request<StudentsListResponse>(
      `/api/students?classManaged=${encodeURIComponent(classManaged)}`,
    ),
  createRoster: (body: CreateRosterRequest) =>
    request<CreateRosterResponse>("/api/students/roster", {
      method: "POST",
      body,
    }),
  parseRosterText: (body: ParseRosterTextRequest) =>
    request<ParseRosterTextResponse>("/api/students/roster/parse-text", {
      method: "POST",
      body,
    }),
  addStudent: (body: AddStudentRequest) =>
    request<StudentMutationResponse>("/api/students", {
      method: "POST",
      body,
    }),
  updateStudent: (
    id: string,
    body: { name?: string; rollNumber?: string; schoolId?: string; parentEmail?: string },
  ) =>
    request<StudentMutationResponse>(`/api/students/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),
  deleteStudent: (id: string) =>
    request<DeleteStudentResponse>(`/api/students/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // Teachers
  teacherSignIn: (body: TeacherSignInRequest) =>
    request<TeacherProfile>("/api/teachers/sign-in", {
      method: "POST",
      body,
    }),
  getTeacherMe: (email: string) =>
    request<TeacherProfile>(
      `/api/teachers/me?email=${encodeURIComponent(email)}`,
    ),
  listTeachers: () => request<TeachersListResponse>("/api/teachers"),
  getChatMessages: (after?: string) => {
    const qs = after ? `?after=${encodeURIComponent(after)}` : "";
    return request<ChatMessagesResponse>(`/api/teachers/chat/messages${qs}`);
  },
  sendChatMessage: (body: SendChatMessageRequest) =>
    request<SendChatMessageResponse>("/api/teachers/chat/messages", {
      method: "POST",
      body,
    }),
  deleteChatMessage: (id: string, email: string) =>
    request<{ ok: boolean; deletedId: string }>(
      `/api/teachers/chat/messages/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`,
      { method: "DELETE" },
    ),

  // Notifications
  getNotifications: () => request<NotificationsResponse>("/api/notifications"),
  listAdminNotifications: () =>
    request<NotificationsResponse>("/api/admin/notifications", {
      headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
    }),
  createAdminNotification: (body: CreateNotificationRequest) =>
    request<{ notification: AdminNotification }>("/api/admin/notifications", {
      method: "POST",
      body,
      headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
    }),
  deleteAdminNotification: (id: string) =>
    request<{ ok: boolean; deletedId: string }>(
      `/api/admin/notifications/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
      },
    ),

  getAdminMonitor: () =>
    request<AdminMonitorResponse>("/api/admin/monitor", {
      headers: { "X-Admin-Passcode": ADMIN_PASSCODE },
    }),

  teacherPresence: (email: string) =>
    request<{ ok: boolean; lastSeenAt: string | null }>("/api/teachers/presence", {
      method: "POST",
      body: { email },
    }),
};
