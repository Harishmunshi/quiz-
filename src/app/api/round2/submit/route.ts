import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { submitRound2Schema } from '@/lib/validation/schemas';
import { validateRound2Order, calculateFinalTime } from '@/lib/scoring/round2';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submitRound2Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { attemptId, submittedOrder, clientElapsedMs } = parsed.data;

    const attempt = await db.round2Attempt.findUnique({
      where: { id: attemptId },
      include: { challenge: true },
    });

    if (!attempt || attempt.status !== 'started') {
      return NextResponse.json({ success: false, error: 'Invalid attempt' }, { status: 403 });
    }

    const correctOrder = JSON.parse(attempt.challenge.correctOrder) as string[];
    const settings = await db.competitionSettings.findFirst();
    const penaltyMs = (settings?.round2PenaltySeconds || 0) * 1000;

    // SERVER-SIDE timing — authoritative
    const now = new Date();
    const serverElapsedMs = now.getTime() - new Date(attempt.startedAt).getTime();

    // SERVER-SIDE validation
    const { isCorrect } = validateRound2Order(submittedOrder, correctOrder);

    const finalTimeMs = isCorrect ? calculateFinalTime(serverElapsedMs, 0) : 0;

    await db.round2Attempt.update({
      where: { id: attemptId },
      data: {
        submittedAt: now,
        clientElapsedMs,
        serverElapsedMs,
        isCorrect,
        penaltyMs: isCorrect ? 0 : penaltyMs,
        finalTimeMs: isCorrect ? finalTimeMs : null,
        status: isCorrect ? 'correct' : 'incorrect',
        submittedOrder: JSON.stringify(submittedOrder),
      },
    });

    // Check remaining attempts
    const attemptCount = await db.round2Attempt.count({
      where: {
        participantId: attempt.participantId,
        challengeId: attempt.challengeId,
        status: { not: 'invalidated' },
      },
    });

    const canRetry = !isCorrect && (settings?.allowRound2Retry ?? true) && attemptCount < attempt.challenge.maxAttempts;

    return NextResponse.json({
      success: true,
      isCorrect,
      serverElapsedMs,
      finalTimeMs,
      canRetry,
      remainingAttempts: attempt.challenge.maxAttempts - attemptCount,
    });
  } catch (error) {
    console.error('Error submitting Round 2:', error);
    return NextResponse.json({ success: false, error: 'Submission failed' }, { status: 500 });
  }
}
