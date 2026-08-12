// ============================================================
// ROUND 2 SCORING — Pure functions, no side effects
// ============================================================

/**
 * Validate a submitted ordering against the correct order.
 * Server-side validation to prevent client manipulation.
 */
export function validateRound2Order(
  submittedOrder: string[],
  correctOrder: string[]
): { isCorrect: boolean; mismatchIndex: number | null } {
  if (submittedOrder.length !== correctOrder.length) {
    return { isCorrect: false, mismatchIndex: 0 };
  }

  for (let i = 0; i < correctOrder.length; i++) {
    if (submittedOrder[i] !== correctOrder[i]) {
      return { isCorrect: false, mismatchIndex: i };
    }
  }

  return { isCorrect: true, mismatchIndex: null };
}

/**
 * Calculate the final time including any penalties.
 */
export function calculateFinalTime(
  serverElapsedMs: number,
  penaltyMs: number
): number {
  return serverElapsedMs + penaltyMs;
}
