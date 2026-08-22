import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { toSection, qualifyTop } from '@/lib/sections';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const settings = await db.competitionSettings.findFirst();
    const isTest = settings?.isTestMode ?? false;

    // ?section=junior|senior narrows the board to one age group. Without it the
    // combined board is returned, which is what the admin panel counts from.
    //
    // Ranks are computed AFTER filtering, so the junior board reads 1, 2, 3
    // rather than the positions those students happened to hold among everyone.
    const section = toSection(new URL(request.url).searchParams.get('section'));

    const attempts = await db.round1Attempt.findMany({
      where: {
        status: 'submitted',
        isTest,
        ...(section ? { participant: { section } } : {}),
      },
      include: { participant: true },
      // `id` last so tied rows have a stable order. Without a unique final key
      // Postgres may return ties in any order, so ranks reshuffled between polls
      // and the board visibly jittered.
      orderBy: [
        { score: 'desc' },
        { completionTimeMs: 'asc' },
        { submittedAt: 'asc' },
        { id: 'asc' },
      ],
    });

    const entries = attempts.map((a, index) => ({
      rank: index + 1,
      participantId: a.participantId,
      participantName: a.participant.name,
      section: a.participant.section,
      // The school is what the hall cares about in an inter-school event; the
      // code is what separates two students from the same school.
      participantCode: a.participant.participantCode,
      schoolName: a.participant.schoolName,
      className: a.participant.className,
      division: a.participant.division,
      language: a.participant.language,
      score: a.score ?? 0,
      totalQuestions: a.totalQuestions ?? 0,
      correctAnswers: a.correctAnswers ?? 0,
      completionTimeMs: a.completionTimeMs ?? 0,
      submittedAt: a.submittedAt ?? a.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: entries,
      meta: {
        section,
        // Where the line falls for this group: 12 juniors, 18 seniors go
        // through to Round 2. Zero on the combined board, which has no cut.
        qualifyTop: section ? qualifyTop(section) : 0,
        total: entries.length,
      },
    });
  } catch (error) {
    console.error('Error fetching R1 leaderboard:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
