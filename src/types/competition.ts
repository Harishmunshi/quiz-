import type { Language, OptionKey, Round1AttemptStatus, Round2AttemptStatus, CompetitionStatus, RoundStatus } from './database';

// ============================================================
// CLIENT VIEW MODES — Client-side router views
// ============================================================
export type AppView =
  | 'landing'
  | 'quiz-english'
  | 'quiz-gujarati'
  | 'register'
  | 'round1-quiz'
  | 'round1-result'
  | 'round1-leaderboard'
  | 'round2-challenge'
  | 'round2-result'
  | 'round2-leaderboard'
  | 'admin-login'
  | 'admin-dashboard'
  | 'admin-questions'
  | 'admin-participants'
  | 'admin-results'
  | 'admin-settings'
  | 'display-qr'
  | 'display-leaderboard';

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================
export interface RegisterParticipantRequest {
  name: string;
  className: string;
  division: string;
  language: Language;
}

export interface RegisterParticipantResponse {
  success: boolean;
  participant?: {
    id: string;
    participantCode: string;
    name: string;
    language: Language;
  };
  error?: string;
}

export interface StartRound1Request {
  participantId: string;
}

export interface SubmitRound1Request {
  attemptId: string;
  answers: Array<{
    questionId: string;
    selectedOption: OptionKey;
  }>;
}

export interface SubmitRound1Response {
  success: boolean;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  completionTimeMs: number;
  error?: string;
}

export interface StartRound2Request {
  participantId: string;
  challengeId: string;
}

export interface SubmitRound2Request {
  attemptId: string;
  submittedOrder: string[];
  clientElapsedMs: number;
}

export interface SubmitRound2Response {
  success: boolean;
  isCorrect: boolean;
  serverElapsedMs: number;
  finalTimeMs: number;
  canRetry: boolean;
  remainingAttempts: number;
  error?: string;
}

// ============================================================
// LEADERBOARD TYPES
// ============================================================
export interface Round1LeaderboardEntry {
  rank: number;
  participantId: string;
  participantName: string;
  className: string;
  division: string;
  language: Language;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completionTimeMs: number;
  submittedAt: string;
}

export interface Round2LeaderboardEntry {
  rank: number;
  participantId: string;
  participantName: string;
  className: string;
  division: string;
  finalTimeMs: number;
  submittedAt: string;
  isCorrect: boolean;
}

// ============================================================
// ADMIN TYPES
// ============================================================
export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  adminName?: string;
  error?: string;
}

export interface CompetitionUpdateRequest {
  competitionStatus?: CompetitionStatus;
  round1Status?: RoundStatus;
  round2Status?: RoundStatus;
  isTestMode?: boolean;
  round1TotalQuestions?: number;
  round1TimeLimit?: number;
  round2TimeLimit?: number;
  allowRound2Retry?: boolean;
  round2PenaltySeconds?: number;
}

export interface QuestionFormData {
  questionNumber: number;
  englishQuestion: string;
  gujaratiQuestion: string;
  optionAEnglish: string;
  optionBEnglish: string;
  optionCEnglish: string;
  optionDEnglish: string;
  optionAGujarati: string;
  optionBGujarati: string;
  optionCGujarati: string;
  optionDGujarati: string;
  correctOption: OptionKey;
  marks: number;
  round: number;
  isActive: boolean;
}

export interface ChallengeFormData {
  challengeNumber: number;
  prompt: string;
  items: string[];
  correctOrder: string[];
  timeLimitMs: number;
  maxAttempts: number;
  isActive: boolean;
}

// ============================================================
// REALTIME TYPES
// ============================================================
export type RealtimeEvent =
  | { type: 'round1_new_result'; data: Round1LeaderboardEntry }
  | { type: 'round2_new_result'; data: Round2LeaderboardEntry }
  | { type: 'round1_invalidation'; data: { attemptId: string } }
  | { type: 'round2_invalidation'; data: { attemptId: string } }
  | { type: 'settings_update'; data: Record<string, unknown> }
  | { type: 'connection_status'; data: 'connected' | 'disconnected' | 'reconnecting' };

// ============================================================
// ROUND 1 QUIZ STATE
// ============================================================
export interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface QuizState {
  attemptId: string;
  participantId: string;
  currentQuestionIndex: number;
  answers: Map<string, OptionKey>;
  startedAt: number;
  timeLimit: number; // 0 = no limit
  questions: QuizQuestion[];
}
