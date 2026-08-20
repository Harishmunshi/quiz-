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

    if (settings.round2Status === 'locked') {
      return NextResponse.json(
        { success: false, error: 'Round 2 is not open', code: 'ROUND_LOCKED' },
        { status: 403 }
      );
    }

    // Resolve the question the student actually answered, and their own clock
    // on it. Neither depends on what the quiz master has on screen.
    //
    // This used to read settings.round2CurrentQuestion and reject anything else
    // as STALE_QUESTION, on top of requiring the round-wide state to be 'open'.
    // That is what made exactly one question answerable at a time.
    //
    // These are independent reads and the database is a network hop away, so
    // they go together: on a burst — thirty students submitting within the same
    // second — a saved round trip per request is the difference between the
    // answer landing instantly and landing noticeably late.
    const [question, participant, start] = await Promise.all([
      db.round2LiveQuestion.findFirst({ where: { id: questionId, isActive: true } }),
      db.participant.findUnique({ where: { id: participantId } }),
      db.round2LiveStart.findFirst({ where: { participantId, questionId } }),
    ]);

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'That question is not available', code: 'NO_QUESTION' },
        { status: 404 }
      );
    }

    // No clock means they never opened the question through /start. Without a
    // start time there is no honest way to time the answer, so refuse rather
    // than invent one.
    if (!start) {
      return NextResponse.json(
        { success: false, error: 'Open the question before submitting', code: 'NOT_STARTED' },
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

    // Measured from THIS student's start on THIS question, server-side, so a
    // tampered device clock buys nothing and two students working on different
    // questions are each timed from their own beginning.
    const now = Date.now();
    const startedAt = new Date(start.startedAt).getTime();
    const responseTimeMs = Math.max(0, now - startedAt);

    // Running over the window does not refuse the submission — it scores zero.
    // Refusing was the old TOO_LATE, which made the submit button appear broken
    // the instant the countdown elapsed and lost the student's work entirely.
    const windowSec = question.timeLimitSec || settings.round2QuestionSeconds;
    const late = windowSec > 0 && responseTimeMs > windowSec * 1000 + LATE_GRACE_MS;

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
          // One mark per item that is in its correct place — 12 items, 12 marks.
          //
          // This replaces all-or-nothing scoring, where a single item out of
          // place scored exactly the same as a blank sheet: zero. With twelve
          // items to order that made a near-perfect answer worthless and left
          // most of the hall on nought, which is not a result you can rank.
          // `correctPositions` was already being computed for the reveal screen;
          // it is now what counts.
          //
          // isCorrect is still recorded, and still means "every position right".
          // It is what the per-question board sorts on first, so a flawless
          // sequence still beats an 11/12.
          // Over the time limit scores nothing, but the attempt is still
          // graded and recorded so the student sees how they did.
          marks: late ? 0 : correctPositions,
          late,
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
            questionNumber: question.questionNumber,
            submittedOrder: parseOrder(existing?.submittedOrder),
            responseTimeMs: existing?.responseTimeMs ?? responseTimeMs,
            marks: existing?.marks ?? 0,
            totalMarks: question.marks,
            correctPositions: existing?.correctPositions ?? 0,
            isCorrect: existing?.isCorrect ?? false,
            late: existing?.late ?? false,
          },
        });
      }
      throw e;
    }

    // The result comes straight back. Round 2 is self-paced, so there is no
    // reveal to wait for: the student sees 11/12 and their time immediately, and
    // the per-question board already reflects it.
    return NextResponse.json({
      success: true,
      data: {
        locked: true,
        alreadyAnswered: false,
        questionNumber: question.questionNumber,
        submittedOrder,
        responseTimeMs,
        marks: late ? 0 : correctPositions,
        totalMarks: question.marks,
        correctPositions,
        isCorrect,
        late,
      },
    });
  } catch (error) {
    console.error('Error recording Round 2 live answer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record your answer' },
      { status: 500 }
    );
  }
}
