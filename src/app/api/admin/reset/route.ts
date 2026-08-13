import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { mode } = await request.json();
    const isTest = mode === 'test';

    // Delete test or official data
    await db.round1Answer.deleteMany({
      where: { attempt: { isTest } },
    });

    await db.round1Attempt.deleteMany({ where: { isTest } });
    await db.round2Attempt.deleteMany({ where: { isTest } });

    if (isTest) {
      await db.participant.deleteMany({ where: { isTest: true } });
    }

    return NextResponse.json({ success: true, message: `${isTest ? 'Test' : 'Official'} data cleared` });
  } catch (error) {
    console.error('Error resetting:', error);
    return NextResponse.json({ success: false, error: 'Reset failed' }, { status: 500 });
  }
}
