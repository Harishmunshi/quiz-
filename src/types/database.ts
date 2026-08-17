// ============================================================
// DATABASE TYPES — Mirrors Prisma schema for use across the app
// ============================================================

export type CompetitionStatus = 'draft' | 'test' | 'live' | 'paused' | 'completed';
export type RoundStatus = 'locked' | 'open' | 'paused' | 'closed';
export type Language = 'english' | 'gujarati';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type Round1AttemptStatus = 'in_progress' | 'submitted' | 'invalidated';
export type Round2AttemptStatus = 'started' | 'correct' | 'incorrect' | 'expired' | 'invalidated';

export interface CompetitionSettings {
  id: string;
  name: string;
  schoolName: string;
  description: string | null;
  currentRound: number;
  competitionStatus: CompetitionStatus;
  round1Status: RoundStatus;
  round2Status: RoundStatus;
  round1StartAt: string | null;
  round1EndAt: string | null;
  round2StartAt: string | null;
  round2EndAt: string | null;
  round1TotalQuestions: number;
  round1TimeLimit: number;
  round2TimeLimit: number;
  allowRound2Retry: boolean;
  round2PenaltySeconds: number;
  isTestMode: boolean;
  // Round 2 live mode (admin-gated, one question at a time)
  round2Mode: 'live' | 'free';
  round2CurrentQuestion: number;
  round2QuestionState: 'idle' | 'open' | 'locked' | 'revealed';
  round2QuestionOpenedAt: string | null;
  round2QuestionLockedAt: string | null;
  round2QuestionSeconds: number;
  round2ShowAnswer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  participantCode: string;
  /** Not unique. Several students genuinely share a name; participantCode is
   *  what distinguishes them. */
  name: string;
  /** Collected at registration in place of class + division. */
  schoolName: string;
  /** Nullable in the database since school name replaced them — typing these as
   *  plain strings is what let the projector render "null — null" for every
   *  recent participant. */
  className: string | null;
  division: string | null;
  language: Language;
  round2Eligible?: boolean;
  disqualified?: boolean;
  isTest: boolean;
  createdAt: string;
}

export interface Question {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface Round1Attempt {
  id: string;
  participantId: string;
  startedAt: string;
  submittedAt: string | null;
  completionTimeMs: number | null;
  score: number | null;
  totalQuestions: number | null;
  correctAnswers: number | null;
  incorrectAnswers: number | null;
  status: Round1AttemptStatus;
  isTest: boolean;
  createdAt: string;
  participant?: Participant;
  answers?: Round1Answer[];
}

export interface Round1Answer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOption: OptionKey;
  isCorrect: boolean | null;
  answeredAt: string;
}

export interface Round2Challenge {
  id: string;
  challengeNumber: number;
  prompt: string;
  items: string; // JSON string
  correctOrder: string; // JSON string
  timeLimitMs: number;
  isActive: boolean;
  maxAttempts: number;
  createdAt: string;
}

export interface Round2Attempt {
  id: string;
  participantId: string;
  challengeId: string;
  startedAt: string;
  submittedAt: string | null;
  clientElapsedMs: number | null;
  serverElapsedMs: number | null;
  attemptNumber: number;
  isCorrect: boolean | null;
  penaltyMs: number;
  finalTimeMs: number | null;
  status: Round2AttemptStatus;
  isTest: boolean;
  submittedOrder: string | null;
  createdAt: string;
  participant?: Participant;
  challenge?: Round2Challenge;
}
