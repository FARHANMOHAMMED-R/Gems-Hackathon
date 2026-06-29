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
  ocrMode?: "pasted" | "gurupdf" | "openai" | "gemini" | "claude" | "tesseract";
}

export interface ScanOcrStatusResponse {
  openai: boolean;
  gurupdf: boolean;
  gemini: boolean;
  claude: boolean;
  tesseract: boolean;
  recommended: "ai" | "tesseract";
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

// --- Assessment assigner ---
export type AssessmentDifficulty = "Easy" | "Medium" | "Hard" | "Mixed";

export interface AssessmentQuestion {
  number: string;
  marks: number;
  topic: string;
  chapter: string;
  questionType: string;
  difficulty: string;
  questionText: string;
}

export interface GeneratedAssessment {
  title: string;
  grade: string;
  subject: string;
  difficulty: string;
  chapters: string[];
  topics: string[];
  totalMarks: number;
  durationMinutes: number;
  instructions: string;
  questions: AssessmentQuestion[];
  teacherNotes: string;
}

export interface GenerateAssessmentRequest {
  classManaged: string;
  grade: string;
  subject?: string;
  chapters: string;
  topics: string;
  difficulty: AssessmentDifficulty;
  questionCount?: number;
  durationMinutes?: number;
  additionalNotes?: string;
}

export interface GenerateAssessmentResponse {
  assessment: GeneratedAssessment;
  studentBody: string;
  emailSubject: string;
  analysisMode: "ai" | "local";
}

export interface SendAssessmentRequest {
  classManaged: string;
  replyTo?: string;
  subject: string;
  body: string;
  scope?: "all" | "selected";
  studentIds?: string[];
}

export interface SendAssessmentResponse {
  sent: number;
  failed: number;
  skipped: number;
  provider: "resend" | "smtp";
  results: {
    studentId: string;
    name: string;
    to: string;
    ok: boolean;
    messageId?: string;
    error?: string;
  }[];
}

export interface AssessmentRecipientsResponse {
  classManaged: string;
  total: number;
  withEmail: number;
  withoutEmail: number;
  students: {
    id: string;
    name: string;
    rollNumber: string;
    parentEmail: string;
    canSend: boolean;
  }[];
}

// --- AI providers ---
export type AiProvider = "openai" | "gemini" | "claude";

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  configured: boolean;
  textModel: string;
}

export interface AiProvidersResponse {
  providers: AiProviderInfo[];
}

// --- PPT generator ---
export interface PptSlide {
  layout: "title" | "section" | "bullets" | "content" | "closing";
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  speakerNotes?: string;
}

export interface PptDeck {
  title: string;
  subtitle: string;
  subject: string;
  grade: string;
  slides: PptSlide[];
}

export interface GeneratePptRequest {
  classManaged: string;
  grade: string;
  subject?: string;
  topic: string;
  chapters: string;
  slideCount?: number;
  audience?: "students" | "teachers";
  additionalNotes?: string;
  provider?: AiProvider;
}

export interface PptGenerateResponse {
  deck: PptDeck;
  fileName: string;
  pptxBase64: string;
  analysisMode: "ai" | "local";
  providerUsed: AiProvider | "local";
  slideCount: number;
}

// --- Performance tracker ---
export type ExamPeriod = "PT1" | "Half Yearly" | "PT2" | "Final";

export interface PerformanceStudentRow {
  id: string;
  name: string;
  rollNumber: string;
  marks: Record<ExamPeriod, number | null>;
}

export interface PerformanceDataResponse {
  classManaged: string;
  subject: string;
  academicYear: string;
  maxMarks: number;
  examPeriods: ExamPeriod[];
  students: PerformanceStudentRow[];
}

export interface SavePerformanceMarksRequest {
  classManaged: string;
  subject: string;
  maxMarks: number;
  academicYear?: string;
  entries: { studentId: string; examPeriod: ExamPeriod; marks: number }[];
}

export interface SavePerformanceMarksResponse {
  saved: number;
  subject: string;
  classManaged: string;
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
  parentEmail?: string;
  subject?: string;
  body?: string;
  email: string;
  analysisMode?: "ai" | "local";
}

export interface MailDraftItem {
  studentId: string;
  name: string;
  rollNumber: string;
  parentEmail: string;
  subject: string;
  body: string;
  /** @deprecated use body */
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
  emails: MailDraftItem[];
  analysisMode?: "ai" | "local";
}

export interface SendMailRequest {
  studentId: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
  saveParentEmail?: boolean;
}

export interface SendMailResponse {
  ok: boolean;
  studentId: string;
  to: string;
  messageId: string;
  provider: "resend" | "smtp";
}

export interface SendMailBatchRequest {
  classManaged: string;
  replyTo?: string;
  messages: {
    studentId: string;
    to: string;
    subject: string;
    body: string;
    saveParentEmail?: boolean;
  }[];
}

export interface SendMailBatchResponse {
  sent: number;
  failed: number;
  provider: "resend" | "smtp";
  results: {
    studentId: string;
    to: string;
    ok: boolean;
    messageId?: string;
    error?: string;
  }[];
}

export interface MailStatusResponse {
  configured: boolean;
  provider: "resend" | "smtp" | null;
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
  parentEmail?: string;
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
