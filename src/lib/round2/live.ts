/**
 * Round 2 — live ordering round. Shared types and pure helpers.
 *
 * Flow, driven entirely by the quiz master:
 *
 *   idle ──open──▶ open ──lock──▶ locked ──reveal──▶ revealed ──next──▶ open (Q+1)
 *
 *   idle      nothing on the board yet
 *   open      question is on screen, sequences are being accepted
 *   locked    submissions closed, correct sequence not shown yet
 *   revealed  correct sequence shown, standings final for this question
 *
 * Two rules keep the result defensible:
 *   1. correctOrder never leaves the server while a question is open.
 *   2. responseTimeMs is computed server-side from round2QuestionOpenedAt,
 *      so a tampered device clock cannot buy a better rank.
 */

export type Round2State = 'idle' | 'open' | 'locked' | 'revealed';
export type QuestionType = 'order' | 'mcq';

/** One draggable/tappable item in an ordering question. */
export interface OrderItem {
  key: string;
  /** Primary label, always present. */
  en: string;
  /** Arabic script, where the question has one. */
  ar?: string;
  /** Devanagari (Hindi/Urdu transliteration). */
  hi?: string;
  /** Gujarati script. */
  gu?: string;
}

/** A question as it is safe to send to a student while they are answering. */
export interface PublicLiveQuestion {
  id: string;
  questionNumber: number;
  type: QuestionType;
  titleEnglish: string;
  titleSecondary: string | null;
  promptEnglish: string;
  promptSecondary: string | null;
  items: OrderItem[];
  marks: number;
  timeLimitSec: number;
  /** How many items must be placed. Sent so the client can show "7 / 12". */
  itemCount: number;
}

export function parseItems(json: string): OrderItem[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
  } catch {
    return [];
  }
}

export function parseOrder(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Grade a submitted sequence.
 *
 * All-or-nothing: the sequence is correct only if every position matches.
 * `correctPositions` is reported alongside so the reveal screen can tell a
 * student how close they came — it never affects the score.
 */
export function gradeOrder(
  submitted: string[],
  correct: string[]
): { isCorrect: boolean; correctPositions: number } {
  let correctPositions = 0;
  for (let i = 0; i < correct.length; i++) {
    if (submitted[i] === correct[i]) correctPositions++;
  }
  const isCorrect =
    submitted.length === correct.length && correctPositions === correct.length;
  return { isCorrect, correctPositions };
}

/**
 * Validate a submission before grading it.
 *
 * Rejects anything that isn't a permutation of the question's own items —
 * a hand-crafted request with duplicates, extras, or unknown keys can't
 * sneak past the grader.
 */
export function validateSubmission(
  submitted: string[],
  items: OrderItem[]
): { ok: true } | { ok: false; reason: string } {
  const valid = new Set(items.map((i) => i.key));

  if (submitted.length !== items.length) {
    return { ok: false, reason: `Place all ${items.length} items before submitting` };
  }
  const seen = new Set<string>();
  for (const key of submitted) {
    if (!valid.has(key)) return { ok: false, reason: 'Unknown item in submission' };
    if (seen.has(key)) return { ok: false, reason: 'Duplicate item in submission' };
    seen.add(key);
  }
  return { ok: true };
}

/**
 * How many questions count towards the standings right now.
 *
 * A question that is still `open` is in flight and must not be counted,
 * otherwise everyone would appear to carry a missed-question penalty for the
 * question they are currently working on.
 */
export function scoredQuestionCount(currentQuestion: number, state: Round2State): number {
  if (state === 'locked' || state === 'revealed') return currentQuestion;
  return Math.max(0, currentQuestion - 1);
}

/**
 * Time charged for a question a student did not submit.
 *
 * Without this, skipping would *lower* cumulative time and improve the
 * tiebreak — rewarding not playing.
 */
export function missedQuestionPenaltyMs(questionSeconds: number): number {
  return (questionSeconds > 0 ? questionSeconds : 120) * 1000;
}

export interface LiveLeaderboardEntry {
  rank: number;
  participantId: string;
  participantCode: string;
  participantName: string;
  schoolName: string;
  score: number;
  correctAnswers: number;
  answeredCount: number;
  /** Sum of response times, with unanswered questions charged the full window. */
  totalTimeMs: number;
  /** Set once the current question is scored, for the board animation. */
  lastQuestionCorrect: boolean | null;
  lastQuestionTimeMs: number | null;
  lastQuestionPositions: number | null;
}

/**
 * Rank students: most marks first, then fastest cumulative time.
 *
 * This is the "correct only, time as tiebreak" model — a wrong sequence is
 * worth nothing, and speed only separates students who scored the same.
 */
export function rankLiveEntries(
  rows: Omit<LiveLeaderboardEntry, 'rank'>[]
): LiveLeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.participantName.localeCompare(b.participantName);
  });

  // Standard competition ranking: identical score AND time share a rank.
  let lastRank = 0;
  let lastScore: number | null = null;
  let lastTime: number | null = null;

  return sorted.map((row, i) => {
    const tied = row.score === lastScore && row.totalTimeMs === lastTime;
    const rank = tied ? lastRank : i + 1;
    lastRank = rank;
    lastScore = row.score;
    lastTime = row.totalTimeMs;
    return { ...row, rank };
  });
}

/** 12345 -> "12.345" — fixed width so the digits don't jitter as they tick. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return (ms / 1000).toFixed(3);
}

/** 12345 -> "12.345s" */
export function formatSeconds(ms: number): string {
  return `${formatMs(ms)}s`;
}
