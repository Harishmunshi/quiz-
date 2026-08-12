import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/competition/stats
// Returns aggregate counts for the "live progress" UI.
//   { totalParticipants, totalRound1Submissions, totalRound2Submissions,
//     round1Submitted, round2Submitted (excluding test mode) }
export async function GET() {
  try {
    const settings = await db.competitionSettings.findFirst();
    const isTest = settings?.isTestMode ?? false;

    const [totalParticipants, round1Submitted, round2Submitted] = await Promise.all([
      db.participant.count({ where: { isTest } }),
      db.round1Attempt.count({ where: { status: 'submitted', isTest } }),
      db.round2Attempt.count({ where: { status: 'correct', isTest } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalParticipants,
        round1Submitted,
        round2Submitted,
        isTestMode: isTest,
      },
    });
  } catch (error) {
    console.error('Error fetching competition stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
