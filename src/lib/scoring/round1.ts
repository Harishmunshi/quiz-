// ============================================================
// ROUND 1 SCORING — Pure functions, no side effects
// ============================================================

import type { OptionKey } from '@/types/database';

/**
 * Calculate the score for a set of answers against the answer key.
 * This runs server-side to prevent answer key exposure.
 */
export function calculateRound1Score(
  answers: Array<{ questionId: string; selectedOption: OptionKey }>,
  answerKey: Array<{ questionId: string; correctOption: OptionKey; marks: number }>
): {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    results: Array<{ questionId: string; selectedOption: OptionKey; isCorrect: boolean; marks: number }>;
  } {
  const keyMap = new Map(answerKey.map((k) => [k.questionId, k]));
  let score = 0;
  let correctAnswers = 0;
  let incorrectAnswers = 0;
  const results: Array<{ questionId: string; selectedOption: OptionKey; isCorrect: boolean; marks: number }> = [];

  for (const answer of answers) {
    const key = keyMap.get(answer.questionId);
    const isCorrect = key ? answer.selectedOption === key.correctOption : false;
    const marks = isCorrect && key ? key.marks : 0;

    if (isCorrect) {
      correctAnswers++;
      score += marks;
    } else {
      incorrectAnswers++;
    }

    results.push({
      questionId: answer.questionId,
      selectedOption: answer.selectedOption,
      isCorrect,
      marks,
    });
  }

  return {
    score,
    totalQuestions: answerKey.length,
    correctAnswers,
    incorrectAnswers,
    results,
  };
}
