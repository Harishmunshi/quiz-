import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';

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
  ]),
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

    const { action, questionNumber, questionSeconds, showAnswer, mode } = parsed.data;

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

    if (questions.length === 0 && action !== 'reset' && action !== 'settings') {
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
      case 'settings': {
        if (questionSeconds !== undefined) update.round2QuestionSeconds = questionSeconds;
        if (showAnswer !== undefined) update.round2ShowAnswer = showAnswer;
        if (mode !== undefined) update.round2Mode = mode;
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Round 2 live control error:', error);
    return NextResponse.json(
      { success: false, error: 'Control action failed' },
      { status: 500 }
    );
  }
}
