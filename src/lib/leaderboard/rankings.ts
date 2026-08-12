// ============================================================
// LEADERBOARD RANKING — Pure functions
// ============================================================

import type { Round1LeaderboardEntry, Round2LeaderboardEntry } from '@/types/competition';

/**
 * Sort and rank Round 1 entries.
 * Primary: Highest score
 * Secondary: Lowest completion time
 * Tertiary: Earlier submitted_at
 */
export function rankRound1Entries(
  entries: Round1LeaderboardEntry[]
): Round1LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Primary: highest score
    if (b.score !== a.score) return b.score - a.score;
    // Secondary: lowest completion time
    if (a.completionTimeMs !== b.completionTimeMs) return a.completionTimeMs - b.completionTimeMs;
    // Tertiary: earlier submission
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Sort and rank Round 2 entries.
 * Only correct submissions.
 * Primary: Lowest final_time_ms
 * Secondary: Earlier submitted_at
 */
export function rankRound2Entries(
  entries: Round2LeaderboardEntry[]
): Round2LeaderboardEntry[] {
  const correctEntries = entries.filter((e) => e.isCorrect);

  const sorted = correctEntries.sort((a, b) => {
    // Primary: lowest time
    if (a.finalTimeMs !== b.finalTimeMs) return a.finalTimeMs - b.finalTimeMs;
    // Secondary: earlier submission
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Detect rank changes for animation.
 * Returns the IDs of participants who changed position.
 */
export function detectRankChanges(
  previous: Round1LeaderboardEntry[] | Round2LeaderboardEntry[],
  current: Round1LeaderboardEntry[] | Round2LeaderboardEntry[]
): { newEntryIds: string[]; rankChangedIds: string[]; newFirstId?: string } {
  const prevMap = new Map(previous.map((e) => [e.participantId, e.rank]));
  const newEntryIds: string[] = [];
  const rankChangedIds: string[] = [];
  let newFirstId: string | undefined;

  for (const entry of current) {
    const prevRank = prevMap.get(entry.participantId);
    if (prevRank === undefined) {
      newEntryIds.push(entry.participantId);
    } else if (prevRank !== entry.rank) {
      rankChangedIds.push(entry.participantId);
    }
    if (entry.rank === 1) {
      newFirstId = entry.participantId;
    }
  }

  // Check if #1 changed
  const prevFirst = previous.find((e) => e.rank === 1);
  if (prevFirst && prevFirst.participantId !== newFirstId) {
    // #1 changed
  } else if (!prevFirst && newFirstId) {
    // First entry ever
  }

  return { newEntryIds, rankChangedIds, newFirstId };
}
