import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { participantId, challengeId } = await request.json();
    if (!participantId || !challengeId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const settings = await db.competitionSettings.findFirst();
    if (!settings || settings.round2Status !== 'open') {
      return NextResponse.json({ success: false, error: 'Round 2 is not open' }, { status: 403 });
    }

    const challenge = await db.round2Challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !challenge.isActive) {
      return NextResponse.json({ success: false, error: 'Challenge not available' }, { status: 404 });
    }

    // Check existing attempts count
    const attemptCount = await db.round2Attempt.count({
      where: { participantId, challengeId, status: { not: 'invalidated' }, isTest: settings.isTestMode },
    });

    if (attemptCount >= challenge.maxAttempts) {
      return NextResponse.json({ success: false, error: 'Maximum attempts reached' }, { status: 403 });
    }

    const attempt = await db.round2Attempt.create({
      data: {
        participantId,
        challengeId,
        attemptNumber: attemptCount + 1,
        status: 'started',
        isTest: settings.isTestMode,
      },
    });

    return NextResponse.json({
      success: true,
      data: { attemptId: attempt.id, attemptNumber: attempt.attemptNumber },
    });
  } catch (error) {
    console.error('Error starting Round 2:', error);
    return NextResponse.json({ success: false, error: 'Failed to start challenge' }, { status: 500 });
  }
}
