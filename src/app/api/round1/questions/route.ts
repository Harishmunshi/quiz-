import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const settings = await db.competitionSettings.findFirst();
    const limit = settings?.round1TotalQuestions || 10;

    const questions = await db.question.findMany({
      where: { round: 1, isActive: true },
      orderBy: { questionNumber: 'asc' },
      take: limit,
    });

    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 });
  }
}
