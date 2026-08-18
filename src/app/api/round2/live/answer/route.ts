import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';
import { gradeOrder, parseItems, parseOrder, validateSubmission } from '@/lib/round2/live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const answerSchema = z.object({
  participantId: z.string().min(1, 'Participant required'),
  questionId: z.string().min(1, 'Question required'),
  submittedOrder: z.array(z.string().min(1)).min(1, 'Place the items before submitting'),
});

// Small allowance for network latency so a student who tapped just before the
// buzzer isn't punished for their connection.
const LATE_GRACE_MS = 1500;

/**
 * POST /api/round2/live/answer
 *
 * One shot per student per question. Four independent guards:
 *   1. The server checks state === 'open'; submissions outside the window bounce.
 *   2. responseTimeMs is derived from round2QuestionOpenedAt on the server.
 *   3. The sequence must be a genuine permutation of the question's own items.
 *   4. A unique index on (participantId, questionId) makes a second answer
 *      physically impossible, even from two tabs racing each other.
 *
 * The response deliberately does NOT reveal whether the sequence was right.
 */
export async function POST(request: Request) {
  try {
    const parsed = answerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { participantId, questionId, submittedOrder } = parsed.data;

    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    if (settings.round2QuestionState !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Submissions are closed for this question', code: 'NOT_OPEN' },
        { status: 409 }
      );
    }

    if (!settings.round2QuestionOpenedAt) {
      return NextResponse.json(
        { success: false, error: 'Question has no open time', code: 'NO_OPEN_TIME' },
        { status: 409 }
      );
    }

    // These two are independent, and the database is a network hop away. Run
    // them together: on a submission burst — thirty students tapping within the
    // same second — one saved round trip per request is the difference between
    // the answer landing instantly and landing noticeably late.
    const [question, participant] = await Promise.all([
      db.round2LiveQuestion.findFirst({
        where: { questionNumber: settings.round2CurrentQuestion, isActive: true },
      }),
      db.participant.findUnique({ where: { id: participantId } }),
    ]);

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'No live question', code: 'NO_QUESTION' },
        { status: 404 }
      );
    }

    // Reject a submission aimed at a different question than the one on screen.
    // Catches a stale tab that missed the move to the next question.
    if (question.id !== questionId) {
      return NextResponse.json(
        { success: false, error: 'This question is no longer on screen', code: 'STALE_QUESTION' },
        { status: 409 }
      );
    }

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found — please rejoin', code: 'NO_PARTICIPANT' },
        { status: 404 }
      );
    }

    // Gate checks live here too, not just at join: a student who joined and was
    // then disqualified must stop scoring immediately, and a hand-crafted POST
    // must never bypass the door.
    if (participant.disqualified) {
      return NextResponse.json(
        { success: false, error: 'You have been removed from this round', code: 'DISQUALIFIED' },
        { status: 403 }
      );
    }
    if (settings.round2RequireQualify && !participant.round2Eligible) {
      return NextResponse.json(
        { success: false, error: 'You did not qualify for Round 2', code: 'NOT_QUALIFIED' },
        { status: 403 }
      );
    }
    if (settings.round2RequirePin && !participant.round2JoinedAt) {
      return NextResponse.json(
        { success: false, error: 'Enter the PIN shown on screen to join', code: 'NOT_JOINED' },
        { status: 403 }
      );
    }

    const items = parseItems(question.items);
    const check = validateSubmission(submittedOrder, items);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.reason, code: 'INVALID_SEQUENCE' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const openedAt = new Date(settings.round2QuestionOpenedAt).getTime();
    const responseTimeMs = Math.max(0, now - openedAt);

    // Enforce the countdown server-side too, so a student who freezes their JS
    // timer still can't submit after time is up.
    const windowSec = question.timeLimitSec || settings.round2QuestionSeconds;
    if (windowSec > 0 && responseTimeMs > windowSec * 1000 + LATE_GRACE_MS) {
      return NextResponse.json(
        { success: false, error: "Time's up for this question", code: 'TOO_LATE' },
        { status: 409 }
      );
    }

    const correct = parseOrder(question.correctOrder);
    const { isCorrect, correctPositions } = gradeOrder(submittedOrder, correct);

    try {
      await db.round2LiveAnswer.create({
        data: {
          participantId,
          questionId: question.id,
          questionNumber: question.questionNumber,
          answerType: 'order',
          submittedOrder: JSON.stringify(submittedOrder),
          isCorrect,
          correctPositions,
          marks: isCorrect ? question.marks : 0,
          responseTimeMs,
          isTest: settings.isTestMode,
        },
      });
    } catch (e: unknown) {
      // P2002 = unique violation = already answered. Treat as success so a
      // double-tap shows "locked in" rather than a scary error.
      if ((e as { code?: string })?.code === 'P2002') {
        const existing = await db.round2LiveAnswer.findUnique({
          where: { participantId_questionId: { participantId, questionId: question.id } },
        });
        return NextResponse.json({
          success: true,
          data: {
            locked: true,
            alreadyAnswered: true,
            submittedOrder: parseOrder(existing?.submittedOrder),
            responseTimeMs: existing?.responseTimeMs ?? responseTimeMs,
          },
        });
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      data: { locked: true, alreadyAnswered: false, submittedOrder, responseTimeMs },
    });
  } catch (error) {
    console.error('Error recording Round 2 live answer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record your answer' },
      { status: 500 }
    );
  }
}
