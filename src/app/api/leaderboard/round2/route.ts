import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await db.competitionSettings.findFirst();
    const isTest = settings?.isTestMode ?? false;

    const attempts = await db.round2Attempt.findMany({
      where: { status: 'correct', isTest, finalTimeMs: { not: null } },
      include: { participant: true },
      orderBy: [{ finalTimeMs: 'asc' }, { submittedAt: 'asc' }, { id: 'asc' }],
    });

    const entries = attempts.map((a, index) => ({
      rank: index + 1,
      participantId: a.participantId,
      participantName: a.participant.name,
      participantCode: a.participant.participantCode,
      schoolName: a.participant.schoolName,
      className: a.participant.className,
      division: a.participant.division,
      finalTimeMs: a.finalTimeMs ?? 0,
      submittedAt: a.submittedAt ?? a.createdAt,
      isCorrect: true,
    }));

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching R2 leaderboard:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
