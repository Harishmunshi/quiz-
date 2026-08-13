import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { submitRound1Schema } from '@/lib/validation/schemas';
import { calculateRound1Score } from '@/lib/scoring/round1';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
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

    // Prevent double submission with atomic update
    const updated = await db.round1Attempt.updateMany({
      where: { id: attemptId, status: 'in_progress' },
      data: { status: 'submitted' },
    });

    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: 'Attempt already submitted or invalid' }, { status: 409 });
    }

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

    // Save answers and update attempt in a transaction-like sequence
    await db.round1Attempt.update({
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
    });

    // Save individual answers
    await db.round1Answer.createMany({
      data: result.results.map(r => ({
        attemptId,
        questionId: r.questionId,
        selectedOption: r.selectedOption,
        isCorrect: r.isCorrect,
      })),
    });

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
    return NextResponse.json({ success: false, error: 'Submission failed' }, { status: 500 });
  }
}
