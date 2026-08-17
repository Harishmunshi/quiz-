import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';
import { invalidateSettings } from '@/lib/round2/settingsCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controlSchema = z.object({
  action: z.enum([
    'open',      // put a question on the board and start accepting answers
    'lock',      // stop accepting answers (correct option still hidden)
    'reveal',    // show the correct option, standings become final for this question
    'next',      // open the next question
    'previous',  // step back a question (recovery from a mis-click)
    'reset',     // clear all Round 2 live answers and go back to idle
    'settings',  // change per-question seconds / show-answer / mode
    'qualify',   // apply the Round 1 cut: mark the top N eligible for Round 2
    'generate-pin', // new join PIN, shown only on the projector
    'clear-pin',
    'disqualify',   // remove a participant mid-round
    'reinstate',
  ]),
  participantId: z.string().optional(),
  qualifyTopN: z.number().int().min(1).max(500).optional(),
  questionNumber: z.number().int().positive().optional(),
  questionSeconds: z.number().int().min(0).max(600).optional(),
  showAnswer: z.boolean().optional(),
  mode: z.enum(['live', 'free']).optional(),
});

/**
 * POST /api/round2/live/control  (admin only)
 *
 * The whole competition is driven from here. Every action is validated against
 * the current state so a stray double-click can't, say, reveal an answer while
 * students are still typing.
 */
export async function POST(request: Request) {
  const admin = requireAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = controlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { action, questionNumber, questionSeconds, showAnswer, mode,
            participantId, qualifyTopN } = parsed.data;

    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const questions = await db.round2LiveQuestion.findMany({
      where: { isActive: true },
      orderBy: { questionNumber: 'asc' },
      select: { questionNumber: true },
    });

    const gateActions = ['reset','settings','qualify','generate-pin','clear-pin','disqualify','reinstate'];
    if (questions.length === 0 && !gateActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'No active Round 2 questions. Add questions first.' },
        { status: 400 }
      );
    }

    const numbers = questions.map((q) => q.questionNumber);
    const current = settings.round2CurrentQuestion || 0;
    const state = settings.round2QuestionState || 'idle';

    const update: Record<string, unknown> = { updatedAt: new Date() };

    /**
     * Start a question's own clock, once.
     *
     * Deliberately only sets openedAt when it is still null. Re-opening or
     * stepping back and forth must not restart it: the clock is what every
     * already-recorded responseTimeMs for that question was measured against,
     * so moving it would silently rewrite everyone's time.
     */
    const openQuestionClock = async (questionNumber: number) => {
      await db.round2LiveQuestion.updateMany({
        where: { questionNumber, isActive: true, openedAt: null },
        data: { openedAt: new Date() },
      });
    };

    /** Close a question for good. This is what ends answering, nothing else. */
    const revealQuestionClock = async (questionNumber: number) => {
      await db.round2LiveQuestion.updateMany({
        where: { questionNumber, isActive: true, revealedAt: null },
        data: { revealedAt: new Date() },
      });
    };

    switch (action) {
      case 'qualify': {
        // Rank Round 1 the same way the leaderboard does — score desc, then
        // fastest completion — and mark the top N eligible. Re-runnable: it
        // clears the previous cut first, so a re-run never leaves stale
        // qualifiers from an earlier ranking.
        const topN = qualifyTopN ?? settings.round2QualifyTopN ?? 20;
        const attempts = await db.round1Attempt.findMany({
          where: { status: 'submitted', isTest: settings.isTestMode },
          orderBy: [{ score: 'desc' }, { completionTimeMs: 'asc' }, { submittedAt: 'asc' }],
          select: { participantId: true },
          take: topN,
        });
        const ids = [...new Set(attempts.map((a) => a.participantId))];

        await db.participant.updateMany({
          where: { isTest: settings.isTestMode },
          data: { round2Eligible: false },
        });
        if (ids.length > 0) {
          await db.participant.updateMany({
            where: { id: { in: ids } },
            data: { round2Eligible: true },
          });
        }
        update.round2QualifyTopN = topN;
        const qualified = await db.competitionSettings.update({
          where: { id: settings.id }, data: update,
        });
        invalidateSettings();
        return NextResponse.json({
          success: true, data: qualified,
          message: `${ids.length} participant${ids.length === 1 ? '' : 's'} qualified for Round 2`,
        });
      }

      case 'generate-pin': {
        // 4 digits is enough: it only has to survive the length of one round,
        // and it is never transmitted to a client that has not already joined.
        const pin = String(Math.floor(1000 + (Date.now() % 9000)));
        update.round2JoinPin = pin;
        update.round2RequirePin = true;
        break;
      }

      case 'clear-pin': {
        update.round2JoinPin = null;
        update.round2RequirePin = false;
        break;
      }

      case 'disqualify':
      case 'reinstate': {
        if (!participantId) {
          return NextResponse.json(
            { success: false, error: 'participantId required' }, { status: 400 }
          );
        }
        await db.participant.update({
          where: { id: participantId },
          data: { disqualified: action === 'disqualify' },
        });
        invalidateSettings();
        const after = await db.competitionSettings.findFirst();
        return NextResponse.json({
          success: true, data: after,
          message: action === 'disqualify' ? 'Participant removed' : 'Participant reinstated',
        });
      }

      case 'settings': {
        if (questionSeconds !== undefined) update.round2QuestionSeconds = questionSeconds;
        if (showAnswer !== undefined) update.round2ShowAnswer = showAnswer;
        if (mode !== undefined) update.round2Mode = mode;
        if (qualifyTopN !== undefined) update.round2QualifyTopN = qualifyTopN;
        break;
      }

      case 'open': {
        const target = questionNumber ?? (current > 0 ? current : numbers[0]);
        if (!numbers.includes(target)) {
          return NextResponse.json(
            { success: false, error: `Question ${target} does not exist in Round 2` },
            { status: 400 }
          );
        }
        // Start that question's own clock (once — see openQuestionClock) and put
        // it on the board. Questions opened earlier stay answerable; opening a
        // new one no longer shuts the previous ones.
        await openQuestionClock(target);
        update.round2CurrentQuestion = target;
        update.round2QuestionState = 'open';
        update.round2QuestionOpenedAt = new Date();
        update.round2QuestionLockedAt = null;
        update.round2Status = 'open';
        if (settings.competitionStatus === 'draft') update.competitionStatus = 'live';
        break;
      }

      case 'lock': {
        if (state !== 'open') {
          return NextResponse.json(
            { success: false, error: `Cannot lock from state "${state}"` },
            { status: 409 }
          );
        }
        update.round2QuestionState = 'locked';
        update.round2QuestionLockedAt = new Date();
        break;
      }

      case 'reveal': {
        if (state !== 'open' && state !== 'locked') {
          return NextResponse.json(
            { success: false, error: `Cannot reveal from state "${state}"` },
            { status: 409 }
          );
        }
        // Revealing from 'open' implicitly locks first — never leak the answer
        // while answers are still being accepted.
        //
        // This is now the ONLY action that closes a question to submissions.
        // Everything else — lock, next, previous — leaves it answerable.
        await revealQuestionClock(current);
        update.round2QuestionState = 'revealed';
        if (state === 'open') update.round2QuestionLockedAt = new Date();
        break;
      }

      case 'next': {
        const idx = numbers.indexOf(current);
        const nextNumber = idx === -1 ? numbers[0] : numbers[idx + 1];
        if (nextNumber === undefined) {
          // Ran off the end — the round is finished, so close the last question
          // for good. Without this it would stay answerable after the round had
          // ended, since revealedAt is the only thing that shuts a question now.
          await revealQuestionClock(current);
          update.round2QuestionState = 'revealed';
          update.round2Status = 'closed';
          const updated = await db.competitionSettings.update({
            where: { id: settings.id },
            data: update,
          });
          invalidateSettings();
          return NextResponse.json({
            success: true,
            data: updated,
            finished: true,
            message: 'All Round 2 questions completed',
          });
        }
        // Moving on starts the next question without closing this one. A student
        // still working through Q1 keeps their chance at it until it is revealed.
        await openQuestionClock(nextNumber);
        update.round2CurrentQuestion = nextNumber;
        update.round2QuestionState = 'open';
        update.round2QuestionOpenedAt = new Date();
        update.round2QuestionLockedAt = null;
        update.round2Status = 'open';
        break;
      }

      case 'previous': {
        const idx = numbers.indexOf(current);
        const prevNumber = idx > 0 ? numbers[idx - 1] : numbers[0];
        update.round2CurrentQuestion = prevNumber;
        // Show it again without reopening the round-wide clock. Whether that
        // question still accepts answers is now decided by its own revealedAt,
        // not by this state, so stepping back is safe: an already-revealed
        // question stays closed, an unrevealed one stays open.
        update.round2QuestionState = 'revealed';
        update.round2QuestionLockedAt = new Date();
        break;
      }

      case 'reset': {
        await db.round2LiveAnswer.deleteMany({ where: { isTest: settings.isTestMode } });
        // Clear the per-question clocks too, or every question would still count
        // as opened-and-possibly-revealed after a reset and the round could not
        // be run again.
        await db.round2LiveQuestion.updateMany({
          data: { openedAt: null, revealedAt: null },
        });
        update.round2CurrentQuestion = 0;
        update.round2QuestionState = 'idle';
        update.round2QuestionOpenedAt = null;
        update.round2QuestionLockedAt = null;
        update.round2Status = 'locked';
        break;
      }
    }

    const updated = await db.competitionSettings.update({
      where: { id: settings.id },
      data: update,
    });
    // Drop the read cache so the very next poll from any screen sees this,
    // rather than waiting out the TTL. Keeps control clicks feeling instant.
    invalidateSettings();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Round 2 live control error:', error);
    return NextResponse.json(
      { success: false, error: 'Control action failed' },
      { status: 500 }
    );
  }
}
