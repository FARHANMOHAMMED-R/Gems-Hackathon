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
  totalTokens: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface AwardResponse {
  awarded: { reason: AwardReason; amount: number };
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

// --- Parent mailer ---
export interface GenerateMailRequest {
  studentId: string;
  recentLimit?: number;
}

export interface GenerateMailResponse {
  studentId: string;
  email: string;
}
