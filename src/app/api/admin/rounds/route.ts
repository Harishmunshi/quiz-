import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';
import { invalidateSettings } from '@/lib/round2/settingsCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  round: z.enum(['round1', 'round2']),
  action: z.enum(['open', 'close']),
});

/**
 * POST /api/admin/rounds   { round, action }   (admin only)
 *
 * Open or close a round. Closing is the "we are done, freeze it" switch: once a
 * round is closed nobody can start a question or submit an answer to it, and
 * the standings stop moving.
 *
 * Deliberately separate from /api/competition, which takes a dozen optional
 * fields and expects the caller to know which combination means "closed". On the
 * day the quiz master wants one button, not a form — and a button that cannot
 * accidentally change the time limit or the test mode flag while it is at it.
 *
 * Reversible: closing and reopening are the same call with a different action,
 * so a round shut by mistake is one click from being open again. Nothing is
 * deleted and no answer is touched.
 */
export async function POST(request: Request) {
  if (!requireAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { round, action } = parsed.data;

    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const status = action === 'open' ? 'open' : 'closed';
    const data: Record<string, unknown> = { updatedAt: new Date() };

    if (round === 'round1') data.round1Status = status;
    else data.round2Status = status;

    // Opening anything means the competition is under way.
    if (action === 'open' && settings.competitionStatus === 'draft') {
      data.competitionStatus = 'live';
    }

    const updated = await db.competitionSettings.update({
      where: { id: settings.id },
      data,
    });
    // Round 2's reads are cached for a second or two; drop it so the close takes
    // effect on the very next request rather than after the TTL.
    invalidateSettings();

    return NextResponse.json({
      success: true,
      data: {
        round1Status: updated.round1Status,
        round2Status: updated.round2Status,
        competitionStatus: updated.competitionStatus,
      },
      message:
        action === 'close'
          ? `${round === 'round1' ? 'Round 1' : 'Round 2'} closed — no further submissions will be accepted`
          : `${round === 'round1' ? 'Round 1' : 'Round 2'} is open`,
    });
  } catch (error) {
    console.error('Round open/close failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not change the round status' },
      { status: 500 }
    );
  }
}
