import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { participantId } = await request.json();
    if (!participantId) {
      return NextResponse.json({ success: false, error: 'Participant ID required' }, { status: 400 });
    }

    const settings = await db.competitionSettings.findFirst();
    if (!settings || settings.round1Status !== 'open') {
      return NextResponse.json({ success: false, error: 'Round 1 is not open' }, { status: 403 });
    }

    const existingAttempt = await db.round1Attempt.findFirst({
      where: { participantId, status: { in: ['in_progress', 'submitted'] }, isTest: settings.isTestMode },
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'submitted') {
        return NextResponse.json({ success: false, error: 'You have already submitted this round' }, { status: 403 });
      }
      return NextResponse.json({ success: true, data: { attemptId: existingAttempt.id, resumed: true } });
    }

    const attempt = await db.round1Attempt.create({
      data: { participantId, status: 'in_progress', isTest: settings.isTestMode },
    });

    return NextResponse.json({ success: true, data: { attemptId: attempt.id, resumed: false } });
  } catch (error) {
    console.error('Error starting Round 1:', error);
    return NextResponse.json({ success: false, error: 'Failed to start quiz' }, { status: 500 });
  }
}
