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

/**
 * POST /api/round2/live/answer
 *
 * One shot per student per question — for ANY question that has been opened and
 * has not had its answer revealed, whatever is currently on the board.
 *
 * WHAT CHANGED AND WHY
 * This used to accept a submission only if the round-wide state was 'open' AND
 * the submitted questionId matched settings.round2CurrentQuestion. Three gates
 * enforced it: a state check, a lookup pinned to the current question number,
 * and a STALE_QUESTION id comparison. Together they meant exactly one question
 * was ever answerable, and only while the quiz master held it open. A student
 * who had not yet submitted Q1 could never submit it once Q2 opened. Locking or
 * revealing shut everyone out of everything.
 *
 * Now the question is resolved from the id the client sent, and the only thing
 * that closes it is its own revealedAt — because once the correct sequence is on
 * the projector, accepting an answer is indefensible. Everything else that
 * mattered is untouched:
 *
 *   1. responseTimeMs is still server-measured, now from that question's own
 *      openedAt, so a tampered device clock still buys nothing.
 *   2. The sequence must still be a genuine permutation of the question's items.
 *   3. The unique index on (participantId, questionId) still makes a second
 *      answer physically impossible, even from two tabs racing.
 *   4. Disqualification, the Round 1 cut and the PIN are still enforced here,
 *      not just at the door.
 *
 * A late answer is accepted and charged the elapsed time honestly, which costs
 * the student on the cumulative-time tiebreak rather than costing them the mark.
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

    // Resolve the question the student actually answered, not whichever one the
    // board happens to be showing. This is the change that lets Q1 be submitted
    // while Q2 is up.
    //
    // These two reads are independent and the database is a network hop away, so
    // they go together: on a burst — thirty students tapping within the same
    // second — one saved round trip per request is the difference between the
    // answer landing instantly and landing noticeably late.
    const [question, participant] = await Promise.all([
      db.round2LiveQuestion.findFirst({ where: { id: questionId, isActive: true } }),
      db.participant.findUnique({ where: { id: participantId } }),
    ]);

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'That question is not part of Round 2', code: 'NO_QUESTION' },
        { status: 404 }
      );
    }

    // A question nobody has started yet is not answerable — otherwise a student
    // could read ahead and bank an answer before the hall has even seen it.
    if (!question.openedAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'That question has not been started yet',
          code: 'NOT_STARTED',
        },
        { status: 409 }
      );
    }

    // The one gate that still closes a question. Once its answer key is on the
    // projector, an answer means nothing.
    if (question.revealedAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'The answer to this question has already been shown',
          code: 'ALREADY_REVEALED',
        },
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

    // Measured from THIS question's own start line, server-side, so a tampered
    // device clock still buys nothing and Q1's time is Q1's time even if Q2 has
    // since opened.
    const now = Date.now();
    const openedAt = new Date(question.openedAt).getTime();
    const responseTimeMs = Math.max(0, now - openedAt);

    // Late answers are accepted but score nothing.
    //
    // The old code returned TOO_LATE past the countdown and refused the write
    // outright, which is what made a question unanswerable the moment its window
    // elapsed — the single biggest source of "my submit button did nothing"
    // during a round. The submission now always lands and is always graded, so
    // the student finds out whether they were right and their attempt is on
    // record; it simply earns no marks. That keeps the countdown meaningful
    // without the button appearing broken.
    const windowSec = question.timeLimitSec || settings.round2QuestionSeconds;
    const late = windowSec > 0 && responseTimeMs > windowSec * 1000;

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
          // Right but late still scores zero. isCorrect stays truthful so the
          // reveal can tell them they had the sequence, and `late` is what
          // explains the zero.
          marks: isCorrect && !late ? question.marks : 0,
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
            questionId: question.id,
            questionNumber: question.questionNumber,
            submittedOrder: parseOrder(existing?.submittedOrder),
            responseTimeMs: existing?.responseTimeMs ?? responseTimeMs,
            late: false,
          },
        });
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      data: {
        locked: true,
        alreadyAnswered: false,
        questionId: question.id,
        questionNumber: question.questionNumber,
        submittedOrder,
        responseTimeMs,
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
