// Shared response/request types mirroring the Gems Assist backend contracts.

export interface HealthResponse {
  ok: boolean;
  service: string;
}

// --- Tokens ---
export type AwardReason = "answering" | "kindness" | "peer_support";

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  grade: string;
  section: string;
  rollNumber?: string;
  schoolId?: string;
  totalTokens: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface AwardResponse {
  awarded: { reason: AwardReason | "custom"; amount: number };
  student: { id: string; name: string; totalTokens: number };
  leaderboard: LeaderboardEntry[];
}

// --- Scan analysis ---
export type ScanMode = "Exam Paper" | "Notebook";

export interface AnalyzeScanRequest {
  mode: ScanMode;
  studentId?: string;
  markingScheme?: string;
  images?: string[];
  rawScannedText?: string;
}

export interface AnalyzeScanResponse {
  score_breakdown: Record<string, unknown>;
  constructive_feedback: string;
  concept_gaps: string[];
  rawScannedText: string;
  recordId?: string;
  /** `local` = offline notebook analysis without OpenAI */
  analysisMode?: "ai" | "local";
  /** How scanned images were read */
  ocrMode?: "pasted" | "gurupdf" | "openai" | "tesseract";
}

// --- Exam blueprint ---
export interface BlueprintQuestion {
  number: string;
  marks: number;
  topic: string;
  questionType: string;
  cognitiveLevel: string;
  description: string;
}

export interface BlueprintSection {
  name: string;
  instructions: string;
  questions: BlueprintQuestion[];
  sectionMarks: number;
}

export interface ExamBlueprint {
  examTitle: string;
  totalMarks: number;
  durationMinutes: number | null;
  sections: BlueprintSection[];
  topicDistribution: {
    topic: string;
    marks: number;
    percentage: number;
    questionCount: number;
  }[];
  cognitiveDistribution: {
    level: string;
    marks: number;
    percentage: number;
  }[];
  summary: string;
}

export interface GenerateBlueprintRequest {
  subject?: string;
  examTitle?: string;
  durationMinutes?: number;
  images?: string[];
  rawScannedText?: string;
}

export interface GenerateBlueprintResponse {
  rawScannedText: string;
  analysisMode: "ai" | "local";
  blueprint: ExamBlueprint;
}

// --- Content differentiation ---
export type DifferentiationTarget =
  | "Advanced"
  | "Standard"
  | "Simplified Visual"
  | "Neurodivergent";

export interface DifferentiateRequest {
  content: string;
  target: DifferentiationTarget;
}

export interface DifferentiateResponse {
  target: DifferentiationTarget;
  content: string;
  analysisMode?: "ai" | "local";
}

// --- Substitution ---
export interface FreeTeacher {
  id: string;
  teacherName: string;
  department: string;
}

export interface SubstitutionResponse {
  period: number;
  department: string | null;
  freeTeachers: FreeTeacher[];
  note?: string;
}

// --- Labs ---
export interface LabReservation {
  id: string;
  roomName: string;
  periodNumber: number;
  date: string;
  reservedByTeacherId: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReserveRequest {
  roomName: string;
  date: string;
  periodNumber: number;
  reservedByTeacherId: string;
}

export interface ReserveResponse {
  ok: boolean;
  reservation: LabReservation;
}

export interface AvailabilityResponse {
  date: string;
  occupied: LabReservation[];
}

export interface ReservationsListResponse {
  reservations: LabReservation[];
}

export interface UpdateLabReservationRequest {
  roomName?: string;
  date?: string;
  periodNumber?: number;
  reservedByTeacherId?: string | null;
  status?: "Free" | "Occupied";
}

export interface UpdateLabReservationResponse {
  ok: boolean;
  reservation: LabReservation;
}

export interface DeleteLabReservationResponse {
  ok: boolean;
  deletedId: string;
}

// --- Parent mailer ---
export interface GenerateMailRequest {
  studentId: string;
  teacherSummary?: string;
  recentLimit?: number;
}

export interface GenerateMailResponse {
  studentId: string;
  name?: string;
  email: string;
}

export interface GenerateMailBatchRequest {
  classManaged: string;
  teacherSummary: string;
  scope: "all" | "selected";
  studentIds?: string[];
  recentLimit?: number;
}

export interface GenerateMailBatchResponse {
  scope: "all" | "selected";
  classManaged: string;
  count: number;
  emails: { studentId: string; name: string; rollNumber: string; email: string }[];
  analysisMode?: "ai" | "local";
}

// --- Teachers ---
export interface TeacherSignInRequest {
  name: string;
  classManaged: string;
  email: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  classManaged: string;
  email: string;
}

export interface TeacherChatMessage {
  id: string;
  teacherId: string;
  teacherName: string;
  classManaged: string;
  teacherEmail: string;
  body: string;
  createdAt: string;
}

export interface TeachersListResponse {
  teachers: TeacherProfile[];
}

export interface ChatMessagesResponse {
  messages: TeacherChatMessage[];
}

export interface SendChatMessageRequest {
  email: string;
  name: string;
  classManaged: string;
  body: string;
}

export interface SendChatMessageResponse {
  message: TeacherChatMessage;
}

// --- Admin notifications ---
export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  priority: "info" | "warning" | "urgent";
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AdminNotification[];
}

export interface CreateNotificationRequest {
  title: string;
  body: string;
  priority?: "info" | "warning" | "urgent";
}

// --- Admin monitor ---
export interface AdminMonitorTeacher {
  id: string;
  name: string;
  email: string;
  classManaged: string;
  lastSeenAt: string | null;
  signedUpAt: string;
  isOnline: boolean;
}

export interface AdminMonitorStudent {
  id: string;
  name: string;
  rollNumber: string;
  schoolId: string;
  classManaged: string;
  grade: string;
  section: string;
  totalTokens: number;
  uploadedAt: string;
}

export interface AdminMonitorResponse {
  stats: {
    totalTeachers: number;
    onlineTeachers: number;
    offlineTeachers: number;
    totalStudents: number;
    totalClasses: number;
  };
  teachers: AdminMonitorTeacher[];
  students: AdminMonitorStudent[];
  classCounts: { classManaged: string; count: number }[];
}
export interface StudentRosterEntry {
  id: string;
  name: string;
  rollNumber: string;
  schoolId: string;
  grade: string;
  section: string;
  classManaged: string;
  totalTokens: number;
}

export interface RosterStatusResponse {
  classManaged: string;
  count: number;
  needsSetup: boolean;
}

export interface StudentsListResponse {
  classManaged: string;
  students: StudentRosterEntry[];
}

export interface CreateRosterRequest {
  classManaged: string;
  students: { name: string; rollNumber: string; schoolId: string }[];
}

export interface CreateRosterResponse {
  classManaged: string;
  students: StudentRosterEntry[];
  count: number;
}

export interface RosterImportStudent {
  name: string;
  rollNumber: string;
  schoolId: string;
}

export interface ParseRosterTextRequest {
  text: string;
}

export interface ParseRosterTextResponse {
  students: RosterImportStudent[];
  count: number;
  analysisMode: "ai" | "local";
}

export interface AddStudentRequest {
  classManaged: string;
  name: string;
  rollNumber: string;
  schoolId: string;
}

export interface StudentMutationResponse {
  student: StudentRosterEntry;
}

export interface DeleteStudentResponse {
  ok: boolean;
  deletedId: string;
}
