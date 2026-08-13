import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/competition — Get current competition settings
export async function GET() {
  try {
    let settings = await db.competitionSettings.findFirst();

    if (!settings) {
      settings = await db.competitionSettings.create({
        data: {
          name: 'Islamic Quiz Competition',
          schoolName: 'M.E.S. English Medium School',
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching competition settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch competition settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/competition — Update competition settings
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { competitionStatus, round1Status, round2Status, isTestMode, round1TotalQuestions, round1TimeLimit, round2TimeLimit, allowRound2Retry, round2PenaltySeconds } = body;

    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json({ success: false, error: 'No competition settings found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (competitionStatus !== undefined) updateData.competitionStatus = competitionStatus;
    if (round1Status !== undefined) updateData.round1Status = round1Status;
    if (round2Status !== undefined) updateData.round2Status = round2Status;
    if (isTestMode !== undefined) updateData.isTestMode = isTestMode;
    if (round1TotalQuestions !== undefined) updateData.round1TotalQuestions = round1TotalQuestions;
    if (round1TimeLimit !== undefined) updateData.round1TimeLimit = round1TimeLimit;
    if (round2TimeLimit !== undefined) updateData.round2TimeLimit = round2TimeLimit;
    if (allowRound2Retry !== undefined) updateData.allowRound2Retry = allowRound2Retry;
    if (round2PenaltySeconds !== undefined) updateData.round2PenaltySeconds = round2PenaltySeconds;

    if (round1Status === 'open' && competitionStatus === 'draft') {
      updateData.competitionStatus = 'live';
    }

    const updated = await db.competitionSettings.update({
      where: { id: settings.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating competition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update competition settings' },
      { status: 500 }
    );
  }
}
