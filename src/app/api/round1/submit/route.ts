import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { submitRound1Schema } from '@/lib/validation/schemas';
import { calculateRound1Score } from '@/lib/scoring/round1';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Tracked out here so the catch below can release the claim. The request body
  // is a one-shot stream — by the time we fail it has long since been consumed.
  let claimedAttemptId: string | null = null;

  try {
    const body = await request.json();
    const parsed = submitRound1Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { attemptId, answers } = parsed.data;

    // Fetch attempt
    const attempt = await db.round1Attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) {
      return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 });
    }

    if (attempt.status === 'submitted') {
      // Idempotent: return existing result
      return NextResponse.json({
        success: true,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        incorrectAnswers: attempt.incorrectAnswers,
        completionTimeMs: attempt.completionTimeMs,
      });
    }

    if (attempt.status === 'invalidated') {
      return NextResponse.json({ success: false, error: 'This attempt has been invalidated' }, { status: 403 });
    }

    if (attempt.status === 'grading') {
      // Another request for this same attempt is mid-grade. Tell the client to
      // come back rather than starting a second grade of the same answers.
      return NextResponse.json(
        { success: false, error: 'Still saving your answers — one moment.', retry: true },
        { status: 409 }
      );
    }

    // Claim the attempt atomically so a double-tap can't grade it twice.
    //
    // This deliberately parks it on 'grading', NOT 'submitted'. The leaderboard
    // selects `status: 'submitted'` and reads `score ?? 0`, so flipping straight
    // to 'submitted' here published the student with a null score for however
    // long the grading below took — they'd flash onto the board at the bottom
    // with 0, then jump to their real rank a moment later. Worse, Postgres sorts
    // NULLS FIRST on `ORDER BY score DESC`, so a mid-grade attempt could briefly
    // show up at rank 1. With thirty students submitting at once that is not a
    // rare flicker, it's the state the board is in most of the time.
    //
    // 'grading' is in neither set: not resumable, not on the board. The attempt
    // becomes visible in one step, already carrying its score.
    const claimed = await db.round1Attempt.updateMany({
      where: { id: attemptId, status: 'in_progress' },
      data: { status: 'grading' },
    });

    if (claimed.count === 0) {
      return NextResponse.json({ success: false, error: 'Attempt already submitted or invalid' }, { status: 409 });
    }
    claimedAttemptId = attemptId;

    const now = new Date();
    const completionTimeMs = now.getTime() - new Date(attempt.startedAt).getTime();

    // Get answer key from questions
    const questionIds = answers.map(a => a.questionId);
    const questions = await db.question.findMany({ where: { id: { in: questionIds } } });

    const answerKey = questions.map(q => ({
      questionId: q.id,
      correctOption: q.correctOption as 'A' | 'B' | 'C' | 'D',
      marks: q.marks,
    }));

    // Calculate score server-side
    const result = calculateRound1Score(answers, answerKey);

    // One transaction: the answer rows and the scored attempt land together, or
    // neither does. Two separate writes meant a lambda that died between them
    // (or simply ran past the 15s cap in vercel.json) left an attempt marked
    // submitted with no answers behind it — unauditable, and unfixable without
    // asking the student to sit the round again.
    //
    // The flip to 'submitted' is the last field written, so the attempt appears
    // on the leaderboard only once its score is committed alongside it.
    await db.$transaction([
      db.round1Answer.createMany({
        data: result.results.map(r => ({
          attemptId,
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          isCorrect: r.isCorrect,
        })),
      }),
      db.round1Attempt.update({
        where: { id: attemptId },
        data: {
          submittedAt: now,
          completionTimeMs,
          score: result.score,
          totalQuestions: result.totalQuestions,
          correctAnswers: result.correctAnswers,
          incorrectAnswers: result.incorrectAnswers,
          status: 'submitted',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      score: result.score,
      totalQuestions: result.totalQuestions,
      correctAnswers: result.correctAnswers,
      incorrectAnswers: result.incorrectAnswers,
      completionTimeMs,
    });
  } catch (error) {
    console.error('Error submitting Round 1:', error);

    // Hand the claim back. Without this an attempt that failed to grade is
    // stranded on 'grading' — invisible to the leaderboard, unresumable by the
    // student, and clearable only by an admin editing the row mid-event.
    if (claimedAttemptId) {
      try {
        await db.round1Attempt.updateMany({
          where: { id: claimedAttemptId, status: 'grading' },
          data: { status: 'in_progress' },
        });
      } catch {
        // Best effort. The original failure is what we report.
      }
    }

    return NextResponse.json({ success: false, error: 'Submission failed' }, { status: 500 });
  }
}
