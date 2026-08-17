import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const joinSchema = z.object({
  participantId: z.string().min(1, 'Participant required'),
  pin: z.string().trim().max(12).optional(),
});

/**
 * POST /api/round2/live/join
 *
 * The door into Round 2. Two independent gates:
 *
 *   1. Qualification — the student must have been included in the Round 1 cut.
 *      This is competition structure: Round 2 is the finals.
 *   2. PIN — a code displayed ONLY on the projector. Someone following along
 *      from outside the hall never sees it.
 *
 * Neither gate stops a student in the hall from being fed answers by someone
 * outside. Only invigilation does. These stop the *uninvited* from polluting
 * the leaderboard, which is a different and solvable problem.
 */
export async function POST(request: Request) {
  try {
    const parsed = joinSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { participantId, pin } = parsed.data;

    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const participant = await db.participant.findUnique({ where: { id: participantId } });
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found — please register again', code: 'NO_PARTICIPANT' },
        { status: 404 }
      );
    }

    if (participant.disqualified) {
      return NextResponse.json(
        { success: false, error: 'You have been removed from this round', code: 'DISQUALIFIED' },
        { status: 403 }
      );
    }

    if (settings.round2RequireQualify && !participant.round2Eligible) {
      return NextResponse.json(
        {
          success: false,
          error: 'You did not qualify for Round 2',
          code: 'NOT_QUALIFIED',
        },
        { status: 403 }
      );
    }

    if (settings.round2RequirePin) {
      const expected = settings.round2JoinPin;
      if (!expected) {
        return NextResponse.json(
          { success: false, error: 'Round 2 has not opened yet', code: 'NO_PIN_SET' },
          { status: 409 }
        );
      }
      if (!pin || pin.trim() !== expected) {
        return NextResponse.json(
          { success: false, error: 'That PIN is not correct', code: 'BAD_PIN' },
          { status: 403 }
        );
      }
    }

    await db.participant.update({
      where: { id: participantId },
      data: { round2JoinedAt: participant.round2JoinedAt ?? new Date() },
    });

    return NextResponse.json({ success: true, data: { joined: true } });
  } catch (error) {
    console.error('Round 2 join error:', error);
    return NextResponse.json({ success: false, error: 'Could not join Round 2' }, { status: 500 });
  }
}
