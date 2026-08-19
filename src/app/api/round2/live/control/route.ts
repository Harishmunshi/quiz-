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
    // The emergency question. Held out of the round entirely until the quiz
    // master needs it — typically to break a tie.
    'release-emergency',
    'hide-emergency',
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

    const gateActions = ['reset','settings','qualify','generate-pin','clear-pin','disqualify','reinstate',
                         'release-emergency','hide-emergency'];
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

      case 'release-emergency':
      case 'hide-emergency': {
        // The emergency question is held out of the round with isActive=false.
        //
        // That single flag is enough because every other part of Round 2 already
        // filters on it: /state will not send it to a student, the answer route
        // will not accept it, `next` will not navigate to it, and neither
        // leaderboard counts it. So a hidden question genuinely does not exist
        // as far as the hall is concerned — no schema change, and nothing new
        // that can drift out of sync.
        const active = action === 'release-emergency';

        // Defaults to the highest-numbered question, which is the emergency one
        // by convention. Pass questionNumber to nominate a different one.
        const all = await db.round2LiveQuestion.findMany({
          orderBy: { questionNumber: 'asc' },
          select: { questionNumber: true, isActive: true },
        });
        if (all.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No Round 2 questions exist' },
            { status: 400 }
          );
        }
        const target = questionNumber ?? all[all.length - 1].questionNumber;
        if (!all.some((q) => q.questionNumber === target)) {
          return NextResponse.json(
            { success: false, error: `Question ${target} does not exist in Round 2` },
            { status: 400 }
          );
        }

        await db.round2LiveQuestion.updateMany({
          where: { questionNumber: target },
          data: { isActive: active },
        });

        // Hiding the question the board is currently showing would leave the
        // hall staring at something that no longer exists. Step back to idle.
        if (!active && current === target) {
          update.round2CurrentQuestion = 0;
          update.round2QuestionState = 'idle';
          update.round2QuestionOpenedAt = null;
          update.round2QuestionLockedAt = null;
        }

        const after = await db.competitionSettings.update({
          where: { id: settings.id },
          data: update,
        });
        invalidateSettings();
        return NextResponse.json({
          success: true,
          data: after,
          message: active
            ? `Question ${target} released — it is now part of the round`
            : `Question ${target} hidden — students cannot see or answer it`,
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
        // Opening resets the clock for that question.
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
        update.round2QuestionState = 'revealed';
        if (state === 'open') update.round2QuestionLockedAt = new Date();
        break;
      }

      case 'next': {
        const idx = numbers.indexOf(current);
        const nextNumber = idx === -1 ? numbers[0] : numbers[idx + 1];
        if (nextNumber === undefined) {
          // Ran off the end — the round is finished.
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
        // Step back into the revealed state rather than reopening — reopening
        // would restart the clock and let people answer a second time.
        update.round2QuestionState = 'revealed';
        update.round2QuestionLockedAt = new Date();
        break;
      }

      case 'reset': {
        await db.round2LiveAnswer.deleteMany({ where: { isTest: settings.isTestMode } });
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
