import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const round = searchParams.get('round') || '1';
    const settings = await db.competitionSettings.findFirst();
    const isTest = settings?.isTestMode ?? false;

    if (round === '1') {
      const attempts = await db.round1Attempt.findMany({
        where: { status: 'submitted', isTest },
        include: { participant: true },
        orderBy: [{ score: 'desc' }, { completionTimeMs: 'asc' }, { submittedAt: 'asc' }],
      });

      const csv = [
        'Rank,Participant,Class,Division,Language,Score,Total,Correct,Completion Time,Submitted At',
        ...attempts.map((a, i) =>
          `${i + 1},"${a.participant.name}",${a.participant.className},${a.participant.division},${a.participant.language},${a.score},${a.totalQuestions},${a.correctAnswers},${a.completionTimeMs}ms,${a.submittedAt?.toISOString() || ''}`
        ),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="round1_results_${isTest ? 'test' : 'official'}.csv"`,
        },
      });
    } else {
      const attempts = await db.round2Attempt.findMany({
        where: { status: 'correct', isTest, finalTimeMs: { not: null } },
        include: { participant: true, challenge: true },
        orderBy: [{ finalTimeMs: 'asc' }, { submittedAt: 'asc' }],
      });

      const csv = [
        'Rank,Participant,Class,Division,Challenge,Completion Time,Submitted At',
        ...attempts.map((a, i) =>
          `${i + 1},"${a.participant.name}",${a.participant.className},${a.participant.division},Challenge ${a.challenge.challengeNumber},${a.finalTimeMs}ms,${a.submittedAt?.toISOString() || ''}`
        ),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="round2_results_${isTest ? 'test' : 'official'}.csv"`,
        },
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 });
  }
}
