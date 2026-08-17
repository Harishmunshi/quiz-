import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';
import {
  rankLiveEntries,
  scoredQuestionCount,
  missedQuestionPenaltyMs,
  type Round2State,
  type LiveLeaderboardEntry,
} from '@/lib/round2/live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** One row of the aggregate, straight from Postgres. */
interface Row {
  id: string;
  participantCode: string;
  name: string;
  schoolName: string;
  score: string | number;
  correctAnswers: string | number;
  answeredCount: string | number;
  totalTimeMs: string | number;
  /** Same figures excluding the most recent question — used for rank movement. */
  prevScore: string | number;
  prevAnsweredCount: string | number;
  prevTotalTimeMs: string | number;
  lastCorrect: number | null;
  lastTimeMs: number | null;
  lastPositions: number | null;
}

const num = (v: string | number | null | undefined): number => Number(v ?? 0);

/**
 * GET /api/round2/live/leaderboard?limit=20
 *
 * Cumulative Round 2 standings: most marks first, then fastest cumulative time.
 * A question a student never answered is charged the full window, so silence
 * cannot improve a tiebreak.
 *
 * PERFORMANCE
 * This used to run three sequential queries (settings, answers, participants).
 * The projector polls it every 1.5s and the admin panel alongside two other
 * endpoints, which — against a pooled connection with `connection_limit=1` —
 * exhausted the pool and produced P2024 timeouts that students saw as
 * "failed to fetch data" mid-round.
 *
 * It is now ONE aggregate. The same pass also computes each student's standing
 * excluding the latest question, which is what lets the board animate people
 * overtaking each other without a second round trip.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const isTest = settings.isTestMode;
    const state = (settings.round2QuestionState || 'idle') as Round2State;
    const scored = scoredQuestionCount(settings.round2CurrentQuestion || 0, state);
    const penaltyMs = missedQuestionPenaltyMs(settings.round2QuestionSeconds);
    const requireQualify = settings.round2RequireQualify;

    // Conditional aggregation gives current AND previous standings in one pass.
    const rows = await db.$queryRaw<Row[]>`
      SELECT
        p.id,
        p."participantCode",
        p.name,
        p."schoolName",
        COALESCE(SUM(a.marks)            FILTER (WHERE a."questionNumber" <= ${scored}), 0) AS "score",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <= ${scored} AND a."isCorrect") AS "correctAnswers",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <= ${scored}) AS "answeredCount",
        COALESCE(SUM(a."responseTimeMs") FILTER (WHERE a."questionNumber" <= ${scored}), 0) AS "totalTimeMs",
        COALESCE(SUM(a.marks)            FILTER (WHERE a."questionNumber" <  ${scored}), 0) AS "prevScore",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <  ${scored}) AS "prevAnsweredCount",
        COALESCE(SUM(a."responseTimeMs") FILTER (WHERE a."questionNumber" <  ${scored}), 0) AS "prevTotalTimeMs",
        MAX(CASE WHEN a."questionNumber" = ${scored} THEN (CASE WHEN a."isCorrect" THEN 1 ELSE 0 END) END) AS "lastCorrect",
        MAX(CASE WHEN a."questionNumber" = ${scored} THEN a."responseTimeMs" END)   AS "lastTimeMs",
        MAX(CASE WHEN a."questionNumber" = ${scored} THEN a."correctPositions" END) AS "lastPositions"
      FROM "Participant" p
      LEFT JOIN "Round2LiveAnswer" a
        ON a."participantId" = p.id AND a."isTest" = ${isTest}
      WHERE p."isTest" = ${isTest}
        AND p."disqualified" = false
        AND (${!requireQualify}::boolean OR p."round2Eligible" = true)
      GROUP BY p.id, p."participantCode", p.name, p."schoolName"
    `;

    const build = (useCurrent: boolean): Omit<LiveLeaderboardEntry, 'rank'>[] =>
      rows.map((r) => {
        const answered = useCurrent ? num(r.answeredCount) : num(r.prevAnsweredCount);
        const questions = useCurrent ? scored : Math.max(0, scored - 1);
        // Unanswered questions are charged the full window.
        const missed = Math.max(0, questions - answered);
        return {
          participantId: r.id,
          participantCode: r.participantCode,
          participantName: r.name,
          schoolName: r.schoolName,
          score: useCurrent ? num(r.score) : num(r.prevScore),
          correctAnswers: num(r.correctAnswers),
          answeredCount: answered,
          totalTimeMs:
            (useCurrent ? num(r.totalTimeMs) : num(r.prevTotalTimeMs)) + missed * penaltyMs,
          lastQuestionCorrect: r.lastCorrect === null ? null : Number(r.lastCorrect) === 1,
          lastQuestionTimeMs: r.lastTimeMs ?? null,
          lastQuestionPositions: r.lastPositions ?? null,
        };
      });

    const ranked = rankLiveEntries(build(true));

    // Where each student stood before the latest question, so the board can show
    // movement rather than just a static order.
    const previousRank = new Map<string, number>();
    if (scored > 1) {
      for (const e of rankLiveEntries(build(false))) previousRank.set(e.participantId, e.rank);
    }

    const withMovement = ranked.map((e) => {
      const prev = previousRank.get(e.participantId) ?? null;
      return {
        ...e,
        previousRank: prev,
        // Positive = climbed. Drives the arrow and its colour on the board.
        rankDelta: prev === null ? null : prev - e.rank,
      };
    });

    return NextResponse.json({
      success: true,
      data: limit ? withMovement.slice(0, limit) : withMovement,
      meta: {
        scoredQuestions: scored,
        currentQuestionNumber: settings.round2CurrentQuestion,
        state,
        totalParticipants: rows.length,
        missedQuestionPenaltyMs: penaltyMs,
        isTestMode: isTest,
      },
    });
  } catch (error) {
    console.error('Error building Round 2 live leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to build leaderboard' },
      { status: 500 }
    );
  }
}
