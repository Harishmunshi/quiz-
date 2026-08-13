import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

/**
 * GET /api/round2/live/leaderboard?limit=20
 *
 * Cumulative Round 2 standings after every question the admin has closed.
 *
 * Ranking model (chosen for this competition):
 *   1. Total marks from correct answers — descending.
 *   2. Cumulative response time — ascending — as the tiebreak.
 *
 * A question a participant never answered is charged the full question window
 * rather than zero. Without that, staying silent would shrink your total time
 * and *improve* your tiebreak, which would reward not playing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const isTest = settings.isTestMode;
    const state = (settings.round2QuestionState || 'idle') as Round2State;
    const scoredCount = scoredQuestionCount(settings.round2CurrentQuestion || 0, state);
    const penaltyMs = missedQuestionPenaltyMs(settings.round2QuestionSeconds);

    // Only answers to questions that are already closed count. An answer to the
    // question currently open must not move the board mid-question.
    const answers = await db.round2LiveAnswer.findMany({
      where: {
        isTest,
        questionNumber: { lte: scoredCount },
      },
      include: {
        participant: {
          select: {
            id: true,
            participantCode: true,
            name: true,
            className: true,
            division: true,
          },
        },
      },
    });

    // Everyone who has joined appears on the board, even at zero — a student
    // who missed Q1 should still see themselves rather than vanish.
    const participants = await db.participant.findMany({
      where: { isTest },
      select: {
        id: true,
        participantCode: true,
        name: true,
        className: true,
        division: true,
      },
    });

    const byParticipant = new Map<string, Omit<LiveLeaderboardEntry, 'rank'>>();

    for (const p of participants) {
      byParticipant.set(p.id, {
        participantId: p.id,
        participantCode: p.participantCode,
        participantName: p.name,
        className: p.className,
        division: p.division,
        score: 0,
        correctAnswers: 0,
        answeredCount: 0,
        totalTimeMs: 0,
        lastQuestionCorrect: null,
        lastQuestionTimeMs: null,
        lastQuestionPositions: null,
      });
    }

    for (const a of answers) {
      let entry = byParticipant.get(a.participantId);
      if (!entry) {
        // Defensive: an answer whose participant was filtered out by isTest.
        entry = {
          participantId: a.participantId,
          participantCode: a.participant.participantCode,
          participantName: a.participant.name,
          className: a.participant.className,
          division: a.participant.division,
          score: 0,
          correctAnswers: 0,
          answeredCount: 0,
          totalTimeMs: 0,
          lastQuestionCorrect: null,
          lastQuestionTimeMs: null,
          lastQuestionPositions: null,
        };
        byParticipant.set(a.participantId, entry);
      }

      entry.answeredCount += 1;
      entry.totalTimeMs += a.responseTimeMs;
      if (a.isCorrect) {
        entry.correctAnswers += 1;
        entry.score += a.marks;
      }

      // Highlight the question that was just closed, for the board animation.
      if (a.questionNumber === scoredCount) {
        entry.lastQuestionCorrect = a.isCorrect;
        entry.lastQuestionTimeMs = a.responseTimeMs;
        entry.lastQuestionPositions = a.correctPositions;
      }
    }

    // Charge unanswered questions.
    for (const entry of byParticipant.values()) {
      const missed = Math.max(0, scoredCount - entry.answeredCount);
      entry.totalTimeMs += missed * penaltyMs;
    }

    const ranked = rankLiveEntries([...byParticipant.values()]);

    return NextResponse.json({
      success: true,
      data: limit ? ranked.slice(0, limit) : ranked,
      meta: {
        scoredQuestions: scoredCount,
        currentQuestionNumber: settings.round2CurrentQuestion,
        state,
        totalParticipants: participants.length,
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
