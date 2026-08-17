import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/round2/live/tick
 *
 * The heartbeat. Every Round 2 screen polls THIS, not the heavy endpoints.
 *
 * WHY
 * `/state` runs four or five queries and returns the whole question — every
 * item, both languages, the lot. `/leaderboard` runs a full aggregate over
 * every participant. Both were being polled continuously by every phone in the
 * hall, the projector and the admin panel, even though the thing they are
 * watching for — the quiz master pressing a button — happens a handful of times
 * per question.
 *
 * So this endpoint answers only one question: *has anything changed?* It
 * returns a short revision string built from the settings row, which is already
 * served from a 700ms in-process cache, plus a single indexed COUNT.
 *
 * Clients compare `rev` to the last one they saw:
 *   - unchanged  → they patch the live submission count and do nothing else
 *   - changed    → they pull the full payload, once
 *
 * That turns the steady state of a live round from "every screen runs five
 * queries per second" into "every screen runs one cheap count per second, and
 * the expensive work happens only at the moment it actually matters". It is
 * what lets the poll interval come DOWN to 500ms — faster reactions and less
 * database load at the same time.
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

    // Every field a screen would re-render for. Anything not in here cannot
    // change without a control action, and control actions always change one
    // of these.
    const rev = [
      settings.round2CurrentQuestion ?? 0,
      settings.round2QuestionState ?? 'idle',
      settings.round2QuestionOpenedAt?.getTime() ?? 0,
      settings.round2QuestionLockedAt?.getTime() ?? 0,
      settings.round2ShowAnswer ? 1 : 0,
      settings.round2Status ?? '',
      settings.round2QuestionSeconds ?? 0,
      settings.round2RequireQualify ? 1 : 0,
      settings.round2RequirePin ? 1 : 0,
    ].join('|');

    // The one number that moves continuously during a question. Counting it
    // here means the student page can show a live "N submitted" without anyone
    // touching the full state route.
    let answerCount = 0;
    if ((settings.round2CurrentQuestion ?? 0) > 0) {
      answerCount = await db.round2LiveAnswer.count({
        where: {
          questionNumber: settings.round2CurrentQuestion,
          isTest: settings.isTestMode,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rev,
        answerCount,
        // Clients correct their countdown against this. Cheap to include and it
        // saves a separate time sync.
        serverNow: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Round 2 tick failed:', error);
    return NextResponse.json({ success: false, error: 'Tick failed' }, { status: 500 });
  }
}
