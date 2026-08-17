import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';
import { requireAdmin } from '@/lib/auth/admin';
import { parseItems, parseOrder } from '@/lib/round2/live';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/round2/live/stats  (admin only)
 *
 * What the quiz master needs in order to decide when to lock: how many have
 * submitted, who is still outstanding, and how the room is doing. It includes
 * the correct sequence, so it must stay behind admin auth — reaching it as a
 * student would give the answer away.
 */
export async function GET(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const isTest = settings.isTestMode;
    const totalParticipants = await db.participant.count({ where: { isTest } });

    const question = settings.round2CurrentQuestion
      ? await db.round2LiveQuestion.findFirst({
          where: { questionNumber: settings.round2CurrentQuestion, isActive: true },
        })
      : null;

    if (!question) {
      return NextResponse.json({
        success: true,
        data: {
          totalParticipants,
          submittedCount: 0,
          pendingCount: totalParticipants,
          correctCount: 0,
          averagePositions: 0,
          fastestCorrect: null,
          correctSequence: [],
          pending: [],
          state: settings.round2QuestionState,
          currentQuestionNumber: settings.round2CurrentQuestion,
          questionTitle: null,
        },
      });
    }

    const answers = await db.round2LiveAnswer.findMany({
      where: { questionId: question.id, isTest },
      include: {
        participant: { select: { id: true, name: true, schoolName: true } },
      },
      orderBy: { responseTimeMs: 'asc' },
    });

    const submittedIds = new Set(answers.map((a) => a.participantId));
    const pending = (
      await db.participant.findMany({
        where: { isTest },
        select: { id: true, name: true, schoolName: true },
        orderBy: { name: 'asc' },
      })
    ).filter((p) => !submittedIds.has(p.id));

    const correctAnswers = answers.filter((a) => a.isCorrect);
    const fastest = correctAnswers[0]
      ? {
          name: correctAnswers[0].participant.name,
          responseTimeMs: correctAnswers[0].responseTimeMs,
        }
      : null;

    const averagePositions =
      answers.length > 0
        ? answers.reduce((sum, a) => sum + a.correctPositions, 0) / answers.length
        : 0;

    // Item labels keyed for the admin's reference display.
    const items = parseItems(question.items);
    const labelByKey = Object.fromEntries(items.map((i) => [i.key, i.en]));
    const correctSequence = parseOrder(question.correctOrder).map(
      (k) => labelByKey[k] ?? k
    );

    return NextResponse.json({
      success: true,
      data: {
        totalParticipants,
        submittedCount: answers.length,
        pendingCount: pending.length,
        correctCount: correctAnswers.length,
        averagePositions: Math.round(averagePositions * 10) / 10,
        itemCount: items.length,
        fastestCorrect: fastest,
        correctSequence,
        pending: pending.slice(0, 60),
        state: settings.round2QuestionState,
        currentQuestionNumber: settings.round2CurrentQuestion,
        questionTitle: question.titleEnglish,
        joinPin: settings.round2JoinPin,
        qualifiedCount: await db.participant.count({
          where: { isTest, round2Eligible: true, disqualified: false },
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching Round 2 live stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
