import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';
import { parseItems } from '@/lib/round2/live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const startSchema = z.object({
  participantId: z.string().min(1, 'Participant required'),
  questionNumber: z.number().int().positive(),
});

/**
 * POST /api/round2/live/start   { participantId, questionNumber }
 *
 * Starts — or resumes — this student's clock on this question, and hands back
 * the question to answer. The Round 2 equivalent of /api/round1/start.
 *
 * Every active question is available for the whole event; there is no quiz
 * master gate. The student opens a question when they are ready and their timer
 * begins then, so two students working on different questions at the same time
 * is normal rather than impossible.
 *
 * Resuming matters more than starting. A reload, a dropped connection or a
 * phone swap must return the SAME startedAt — otherwise refreshing would reset
 * the clock and buy a better time. The unique index on
 * (participantId, questionId) makes that guarantee at the database, so two
 * requests racing each other still end up with one start time.
 *
 * The answer key never leaves the server here.
 */
export async function POST(request: Request) {
  try {
    const parsed = startSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { participantId, questionNumber } = parsed.data;

    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    if (settings.round2Status === 'closed') {
      return NextResponse.json(
        { success: false, error: 'Round 2 is closed', code: 'ROUND_CLOSED' },
        { status: 403 }
      );
    }

    const [question, participant] = await Promise.all([
      // isActive is what holds the emergency question back: an inactive question
      // cannot be started, so it does not exist as far as students are concerned.
      db.round2LiveQuestion.findFirst({ where: { questionNumber, isActive: true } }),
      db.participant.findUnique({ where: { id: participantId } }),
    ]);

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'That question is not available', code: 'NO_QUESTION' },
        { status: 404 }
      );
    }
    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Participant not found — please sign in again', code: 'NO_PARTICIPANT' },
        { status: 404 }
      );
    }
    if (participant.disqualified) {
      return NextResponse.json(
        { success: false, error: 'You have been removed from this round', code: 'DISQUALIFIED' },
        { status: 403 }
      );
    }
    // No qualification gate: Round 2 does not depend on Round 1.

    // Already answered? Say so rather than restarting a clock that can never be
    // used — the answer route would refuse the second submission anyway.
    const existingAnswer = await db.round2LiveAnswer.findUnique({
      where: { participantId_questionId: { participantId, questionId: question.id } },
    });

    // Start once, then always resume.
    let start = await db.round2LiveStart.findUnique({
      where: { participantId_questionId: { participantId, questionId: question.id } },
    });

    if (!start && !existingAnswer) {
      try {
        start = await db.round2LiveStart.create({
          data: { participantId, questionId: question.id, isTest: settings.isTestMode },
        });
      } catch (err) {
        // P2002 = another tab won the race. Read theirs; do not mint a second.
        if ((err as { code?: string })?.code === 'P2002') {
          start = await db.round2LiveStart.findUnique({
            where: { participantId_questionId: { participantId, questionId: question.id } },
          });
        } else {
          throw err;
        }
      }
    }

    const items = parseItems(question.items);

    return NextResponse.json({
      success: true,
      data: {
        // Corrects for device clock drift when drawing the countdown. Scoring
        // never depends on the client's clock.
        serverNow: new Date().toISOString(),
        startedAt: start?.startedAt?.toISOString() ?? null,
        alreadyAnswered: Boolean(existingAnswer),
        myAnswer: existingAnswer
          ? {
              marks: existingAnswer.marks,
              correctPositions: existingAnswer.correctPositions,
              isCorrect: existingAnswer.isCorrect,
              responseTimeMs: existingAnswer.responseTimeMs,
            }
          : null,
        question: {
          id: question.id,
          questionNumber: question.questionNumber,
          titleEnglish: question.titleEnglish,
          titleSecondary: question.titleSecondary,
          promptEnglish: question.promptEnglish,
          promptSecondary: question.promptSecondary,
          items,
          itemCount: items.length,
          marks: question.marks,
          timeLimitSec: question.timeLimitSec,
        },
      },
    });
  } catch (error) {
    console.error('Round 2 start error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not start the question' },
      { status: 500 }
    );
  }
}
