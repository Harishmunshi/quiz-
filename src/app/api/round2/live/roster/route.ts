import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/round2/live/roster
 *
 * Who is in the room for Round 2: name, school, participant code, and whether
 * they have signed in on their phone yet.
 *
 * WHY
 * The quiz master had no way to see who had actually arrived. The only listing
 * was the leaderboard, which shows a student only once they have answered
 * something — so before the first question it was empty and the hall was a
 * guess. This answers "who is here, and from which school" before a single
 * answer exists.
 *
 * Deliberately carries no scores, no answers and no PIN. It is the register,
 * not the result: safe to leave open on the landing page and on the projector.
 * Names and schools are already public on the leaderboard by design.
 */
export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const isTest = settings.isTestMode;
    const requireQualify = settings.round2RequireQualify;

    const participants = await db.participant.findMany({
      where: {
        isTest,
        disqualified: false,
        ...(requireQualify ? { round2Eligible: true } : {}),
      },
      // Signed-in students first so the quiz master can see arrivals landing in
      // real time, then everyone still expected, alphabetically.
      orderBy: [{ round2JoinedAt: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        participantCode: true,
        name: true,
        schoolName: true,
        round2JoinedAt: true,
      },
    });

    const roster = participants.map((p) => ({
      participantId: p.id,
      participantCode: p.participantCode,
      // Not unique — several students genuinely share a name. The code is what
      // tells them apart, which is why it is always sent alongside.
      participantName: p.name,
      schoolName: p.schoolName,
      joined: Boolean(p.round2JoinedAt),
      joinedAt: p.round2JoinedAt?.toISOString() ?? null,
    }));

    const schools = [...new Set(roster.map((r) => r.schoolName).filter(Boolean))].sort();

    return NextResponse.json({
      success: true,
      data: roster,
      meta: {
        total: roster.length,
        joined: roster.filter((r) => r.joined).length,
        schools,
        requiresQualify: requireQualify,
        isTestMode: isTest,
      },
    });
  } catch (error) {
    console.error('Error building Round 2 roster:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load the roster' },
      { status: 500 }
    );
  }
}
