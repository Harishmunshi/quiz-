import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/round2/settingsCache';
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
  /** This question's own start line. Null means it has not been started. */
  openedAt: string | null;
  /** Set once its answer key is public. Non-null means closed for good. */
  revealedAt: string | null;
  /** Whether this student may still submit it. */
  answerable: boolean;
  /** This student's answer to this question, if they have given one. */
  myAnswer: MyAnswerPayload | null;
  /** Correct sequence — present only after this question's own reveal. */
  correctOrder: string[] | null;
  /** How many students have answered it. */
  answerCount: number;
}

interface MyAnswerPayload {
  submittedOrder: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  correctPositions: number | null;
  /** Submitted after the question's time limit: graded and shown, but scores 0. */
  late: boolean;
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

    const settings = await getSettings();
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Competition not configured' },
        { status: 503 }
      );
    }

    const state = (settings.round2QuestionState || 'idle') as Round2State;
    const currentNumber = settings.round2CurrentQuestion || 0;

    // Independent of each other and of everything below — issued together so
    // the route costs one network round trip instead of two.
    const [totalQuestions, me] = await Promise.all([
      db.round2LiveQuestion.count({ where: { isActive: true } }),
      participantId
        ? db.participant.findUnique({
            where: { id: participantId },
            select: { round2Eligible: true, round2JoinedAt: true, disqualified: true },
          })
        : Promise.resolve(null),
    ]);

    // Entry gate for this participant. Computed server-side so the student page
    // renders the right door without having to guess.
    let gate: {
      requiresQualify: boolean;
      requiresPin: boolean;
      qualified: boolean;
      joined: boolean;
      disqualified: boolean;
      blocked: null | 'NOT_QUALIFIED' | 'DISQUALIFIED' | 'NEEDS_PIN';
    } = {
      requiresQualify: settings.round2RequireQualify,
      requiresPin: settings.round2RequirePin,
      qualified: false,
      joined: false,
      disqualified: false,
      blocked: null,
    };

    if (participantId) {
      if (me) {
        gate.qualified = me.round2Eligible;
        gate.joined = Boolean(me.round2JoinedAt);
        gate.disqualified = me.disqualified;
        if (me.disqualified) gate.blocked = 'DISQUALIFIED';
        else if (settings.round2RequireQualify && !me.round2Eligible) gate.blocked = 'NOT_QUALIFIED';
        else if (settings.round2RequirePin && !me.round2JoinedAt) gate.blocked = 'NEEDS_PIN';
      }
    }

    // Every question that has been started, with this student's own answer
    // attached to each.
    //
    // This used to fetch only the one question matching round2CurrentQuestion,
    // which is why a student could never go back to Q1: the client was never
    // sent Q1's items again once Q2 opened, so there was nothing to submit even
    // if the server had allowed it. Sending every opened question is what makes
    // "answer Q1 while Q2 is up" possible on the screen as well as in the API.
    //
    // A blocked participant receives no question bodies at all — withholding
    // them in the UI alone would still leave them readable in the network tab.
    let questions: PublicQuestionPayload[] = [];
    let question: PublicQuestionPayload | null = null;

    if (!participantId || gate.blocked === null) {
      const opened = await db.round2LiveQuestion.findMany({
        where: { isActive: true, openedAt: { not: null } },
        orderBy: { questionNumber: 'asc' },
      });

      // Two aggregate reads instead of one per question: the projector polls
      // this route every 1.5s and a per-question query would multiply that by
      // the number of questions in the round.
      const openedIds = opened.map((q) => q.id);

      // Typed explicitly: `Promise.resolve([])` in the else branch infers never[],
      // which widens the tuple and leaves every field on the rows as unknown.
      type MyAnswerRow = Awaited<ReturnType<typeof db.round2LiveAnswer.findMany>>;

      const [counts, mine] = await Promise.all([
        db.round2LiveAnswer.groupBy({
          by: ['questionId'],
          where: { isTest: settings.isTestMode, questionId: { in: openedIds } },
          _count: { _all: true },
        }),
        participantId
          ? db.round2LiveAnswer.findMany({
              where: { participantId, questionId: { in: openedIds } },
            })
          : (Promise.resolve([]) as Promise<MyAnswerRow>),
      ]);

      const countBy = new Map<string, number>(
        counts.map((c) => [c.questionId, c._count._all] as const)
      );
      const mineBy = new Map<string, MyAnswerRow[number]>(
        mine.map((a) => [a.questionId, a] as const)
      );

      questions = opened.map((q) => {
        const items = parseItems(q.items);
        const answer = mineBy.get(q.id);
        // Correctness is withheld until THIS question's reveal — one student
        // learning they were right would tell the whole room.
        const revealed = Boolean(q.revealedAt);

        return {
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
          openedAt: q.openedAt?.toISOString() ?? null,
          revealedAt: q.revealedAt?.toISOString() ?? null,
          // Answerable = started, not revealed, and this student hasn't answered.
          // Independent of which question the board is showing.
          answerable: !revealed && !answer,
          myAnswer: answer
            ? {
                submittedOrder: parseOrder(answer.submittedOrder),
                responseTimeMs: answer.responseTimeMs,
                isCorrect: revealed ? answer.isCorrect : null,
                correctPositions: revealed ? answer.correctPositions : null,
                // Not withheld until the reveal: a student who submitted late
                // should be told so immediately, not left expecting marks.
                late: answer.late,
              }
            : null,
          // The answer key crosses the wire only after that question's reveal.
          correctOrder:
            revealed && settings.round2ShowAnswer ? parseOrder(q.correctOrder) : null,
          answerCount: countBy.get(q.id) ?? 0,
        };
      });

      // The question the board is on, kept for the projector and for clients
      // that only ever render one at a time.
      question = questions.find((q) => q.questionNumber === currentNumber) ?? null;
    }

    // Back-compat: these three were top-level before questions[] existed, and
    // the projector and admin screens still read them.
    const correctOrder = question?.correctOrder ?? null;
    const answerCount = question?.answerCount ?? 0;
    const myAnswer = question?.myAnswer ?? null;

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
        gate,
        // The PIN itself is never sent to a student device. The projector board
        // reads it from the admin-only stats endpoint.
        pinIsSet: Boolean(settings.round2JoinPin),
        question,
        correctOrder,
        answerCount,
        myAnswer,
        // Every started question, each with this student's answer and whether
        // they may still submit it. The student screen drives its question
        // switcher from this.
        questions,
        answerableCount: questions.filter((q) => q.answerable).length,
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
