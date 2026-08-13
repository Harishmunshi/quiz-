import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const challenges = await db.round2Challenge.findMany({
      where: { isActive: true },
      orderBy: { challengeNumber: 'asc' },
    });
    return NextResponse.json({ success: true, data: challenges });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch challenges' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { challengeNumber, prompt, items, correctOrder, timeLimitMs, maxAttempts, isActive } = body;

    const challenge = await db.round2Challenge.create({
      data: {
        challengeNumber,
        prompt,
        items: JSON.stringify(items),
        correctOrder: JSON.stringify(correctOrder),
        timeLimitMs: timeLimitMs || 60000,
        maxAttempts: maxAttempts || 3,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: challenge });
  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json({ success: false, error: 'Failed to create challenge' }, { status: 500 });
  }
}
