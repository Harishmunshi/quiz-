import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const lookupSchema = z.object({
  code: z.string().trim().min(3, 'Enter your participant code').max(32),
});

/**
 * POST /api/participant/lookup   { code: "MES0007" }
 *
 * Resolves a Round 1 participant code to that participant's identity so Round 2
 * can continue with the SAME person.
 *
 * This is the join between the two rounds. Without it, /round2 had no way to
 * ask "who are you?" and instead offered a registration form — which minted a
 * brand new Participant row with no Round 1 attempt attached, and therefore one
 * that could never qualify. Two identity systems for one student.
 *
 * Deliberately returns only what the Round 2 UI needs to greet the student and
 * decide which door to show. No scores, no answers, no other participants.
 * Guessing a neighbour's code reveals nothing useful, and the PIN still gates
 * actually entering the round.
 */
export async function POST(request: Request) {
  try {
    const parsed = lookupSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // Codes are issued uppercase (MES0001); accept any casing the student types.
    const code = parsed.data.code.toUpperCase();

    const participant = await db.participant.findUnique({
      where: { participantCode: code },
      select: {
        id: true,
        participantCode: true,
        name: true,
        schoolName: true,
        language: true,
        round2Eligible: true,
        disqualified: true,
        round2JoinedAt: true,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'No participant found with that code', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Did they actually sit Round 1? Surfaced so the student sees a truthful
    // reason rather than a blank "not qualified".
    const round1 = await db.round1Attempt.findFirst({
      where: { participantId: participant.id, status: 'submitted' },
      select: { submittedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        participant: {
          id: participant.id,
          participantCode: participant.participantCode,
          name: participant.name,
          schoolName: participant.schoolName,
          language: participant.language,
        },
        completedRound1: Boolean(round1),
        round2Eligible: participant.round2Eligible,
        disqualified: participant.disqualified,
        alreadyJoined: Boolean(participant.round2JoinedAt),
      },
    });
  } catch (error) {
    console.error('Participant lookup failed:', error);
    return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 });
  }
}
