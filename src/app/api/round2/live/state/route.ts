import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  parseItems,
  parseOrder,
  type OrderItem,
  type Round2State,
} from '@/lib/round2/live';

/** The question shape sent to the browser — deliberately without the answer key. */
interface PublicQuestionPayload {
  id: string;
  questionNumber: number;
  type: string;
  titleEnglish: string;
  titleSecondary: string | null;
  promptEnglish: string;
  promptSecondary: string | null;
  items: OrderItem[];
  itemCount: number;
  marks: number;
  timeLimitSec: number;
}

// Polled endpoint — never cache, never statically render.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * GET /api/round2/live/state?participantId=...
 *
 * The single source of truth every Round 2 screen renders from — student page,
 * projector board, and admin panel.
 *
 * `correctOrder` is included ONLY once the quiz master has revealed. While a
 * question is open the payload is deliberately useless to anyone inspecting
 * network traffic.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const participantId = searchParams.get('participantId');

    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const state = (settings.round2QuestionState || 'idle') as Round2State;
    const currentNumber = settings.round2CurrentQuestion || 0;

    const totalQuestions = await db.round2LiveQuestion.count({ where: { isActive: true } });

    let question: PublicQuestionPayload | null = null;
    let correctOrder: string[] | null = null;
    let answerCount = 0;
    let myAnswer: {
      submittedOrder: string[];
      responseTimeMs: number;
      isCorrect: boolean | null;
      correctPositions: number | null;
    } | null = null;

    if (currentNumber > 0 && state !== 'idle') {
      const q = await db.round2LiveQuestion.findFirst({
        where: { questionNumber: currentNumber, isActive: true },
      });

      if (q) {
        const items = parseItems(q.items);

        question = {
          id: q.id,
          questionNumber: q.questionNumber,
          type: q.type,
          titleEnglish: q.titleEnglish,
          titleSecondary: q.titleSecondary,
          promptEnglish: q.promptEnglish,
          promptSecondary: q.promptSecondary,
          items,
          itemCount: items.length,
          marks: q.marks,
          timeLimitSec: q.timeLimitSec,
        };

        // The answer key crosses the wire only after the reveal.
        if (state === 'revealed' && settings.round2ShowAnswer) {
          correctOrder = parseOrder(q.correctOrder);
        }

        answerCount = await db.round2LiveAnswer.count({
          where: { questionId: q.id, isTest: settings.isTestMode },
        });

        if (participantId) {
          const mine = await db.round2LiveAnswer.findUnique({
            where: { participantId_questionId: { participantId, questionId: q.id } },
          });
          if (mine) {
            myAnswer = {
              submittedOrder: parseOrder(mine.submittedOrder),
              responseTimeMs: mine.responseTimeMs,
              // Correctness is withheld until the reveal — one student learning
              // they were right would tell the whole room.
              isCorrect: state === 'revealed' ? mine.isCorrect : null,
              correctPositions: state === 'revealed' ? mine.correctPositions : null,
            };
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        // Clients use serverNow to correct for device clock drift when drawing
        // the countdown. Scoring never depends on it.
        serverNow: new Date().toISOString(),
        mode: settings.round2Mode,
        round2Status: settings.round2Status,
        state,
        currentQuestionNumber: currentNumber,
        totalQuestions,
        questionSeconds: settings.round2QuestionSeconds,
        openedAt: settings.round2QuestionOpenedAt?.toISOString() ?? null,
        lockedAt: settings.round2QuestionLockedAt?.toISOString() ?? null,
        showAnswer: settings.round2ShowAnswer,
        question,
        correctOrder,
        answerCount,
        myAnswer,
      },
    });
  } catch (error) {
    console.error('Error fetching Round 2 live state:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live state' },
      { status: 500 }
    );
  }
}
