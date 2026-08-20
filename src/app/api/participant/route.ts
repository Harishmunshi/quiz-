import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { registerParticipantSchema } from '@/lib/validation/schemas';

// Always run on request: these endpoints read live competition state and
// must never be statically rendered or cached by Next.js.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const formatCode = (n: number | bigint) => `MES${String(n).padStart(4, '0')}`;

/**
 * Claim a participant code that nobody else is getting.
 *
 * The old line here was `count() + 1`. COUNT(*) is a read, so thirty students
 * tapping Register in the same second all read the same number, all build the
 * same code, and all but one bounce off the UNIQUE index on participantCode —
 * surfacing as "Registration failed. Please try again." for the other 29.
 *
 * Fast path: a Postgres sequence (migration 006). nextval() is atomic and
 * contention-free, so concurrency stops mattering entirely.
 *
 * Fallback: if the sequence hasn't been created yet, walk forward from the
 * highest code on record with a random stride. The UNIQUE index stays the
 * arbiter — we just retry around it. The stride is what makes this converge
 * under load instead of having every loser re-collide on max+1 next pass.
 * Gaps in the numbering are fine; the code is an identifier, not a count.
 */
async function nextParticipantCode(): Promise<string | null> {
  try {
    const rows = await db.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('participant_code_seq') AS nextval
    `;
    if (rows[0]?.nextval != null) return formatCode(rows[0].nextval);
  } catch {
    // Sequence not created yet — fall through to the retry path below.
  }
  return null;
}

async function highestCodeNumber(): Promise<number> {
  const rows = await db.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(NULLIF(regexp_replace("participantCode", '\D', '', 'g'), '')::int) AS max
    FROM "Participant"
  `;
  return rows[0]?.max ?? 0;
}

// POST /api/participant — Register a new participant
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerParticipantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // Check competition status
    const settings = await db.competitionSettings.findFirst();
    if (!settings) {
      return NextResponse.json({ success: false, error: 'Competition not configured' }, { status: 503 });
    }

    if (settings.competitionStatus === 'completed') {
      return NextResponse.json({ success: false, error: 'Competition has ended' }, { status: 403 });
    }

    // IDs are issued by the school and typed in by the student, so this is a
    // sign-in as much as a registration. Normalise so the same card typed twice
    // is the same student.
    //
    // Upper-cased, and runs of whitespace collapsed to one space: "M.E.S.B  S-1"
    // and "m.e.s.b s-1" are one person, not three rows with a split score. The
    // characters themselves are left alone — dots, spaces and hyphens are part
    // of real school IDs.
    const typedCode = parsed.data.participantCode
      ?.trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();

    const row = {
      // The name is no longer asked for. It falls back to the code so every
      // downstream screen that still prints a name has something to print.
      name: parsed.data.name?.trim() || typedCode || 'Student',
      schoolName: parsed.data.schoolName,
      language: parsed.data.language,
      isTest: settings.isTestMode,
    };

    if (typedCode) {
      const existing = await db.participant.findUnique({
        where: { participantCode: typedCode },
      });

      // Known code: sign them back in rather than refusing. A student who
      // reloads, switches phone, or comes back for Round 2 must land on the
      // same participant — creating a second one would strand their Round 1
      // result and make them permanently unqualifiable.
      if (existing) {
        if (existing.disqualified) {
          return NextResponse.json(
            { success: false, error: 'You have been removed from this competition', code: 'DISQUALIFIED' },
            { status: 403 }
          );
        }
        // Let them correct a school typed wrong the first time.
        const refreshed =
          existing.schoolName === parsed.data.schoolName
            ? existing
            : await db.participant.update({
                where: { id: existing.id },
                data: { schoolName: parsed.data.schoolName },
              });

        return NextResponse.json({
          success: true,
          returning: true,
          participant: {
            id: refreshed.id,
            participantCode: refreshed.participantCode,
            name: refreshed.name,
            schoolName: refreshed.schoolName,
            language: refreshed.language,
          },
        });
      }

      try {
        const created = await db.participant.create({
          data: { participantCode: typedCode, ...row },
        });
        return NextResponse.json({
          success: true,
          returning: false,
          participant: {
            id: created.id,
            participantCode: created.participantCode,
            name: created.name,
            schoolName: created.schoolName,
            language: created.language,
          },
        });
      } catch (err) {
        // Two students submitting the same new code in the same instant: the
        // UNIQUE index arbitrates, and the loser is simply signed in to the row
        // the winner created.
        if ((err as { code?: string })?.code === 'P2002') {
          const now = await db.participant.findUnique({ where: { participantCode: typedCode } });
          if (now) {
            return NextResponse.json({
              success: true,
              returning: true,
              participant: {
                id: now.id,
                participantCode: now.participantCode,
                name: now.name,
                schoolName: now.schoolName,
                language: now.language,
              },
            });
          }
        }
        throw err;
      }
    }

    // No code supplied — fall back to issuing one (older clients, and the
    // sequence path from migration 006).
    const sequenced = await nextParticipantCode();

    let participant;
    if (sequenced) {
      participant = await db.participant.create({
        data: { participantCode: sequenced, ...row },
      });
    } else {
      // No sequence available. Retry around the UNIQUE index instead.
      let floor = await highestCodeNumber();
      let created: Awaited<ReturnType<typeof db.participant.create>> | null = null;

      for (let attempt = 0; attempt < 12 && !created; attempt++) {
        // Widen the stride each pass so two racers that collide once are
        // unlikely to collide again.
        const stride = attempt === 0 ? 1 : 1 + Math.floor(Math.random() * (attempt * 8));
        const candidate = formatCode(floor + stride);
        try {
          created = await db.participant.create({
            data: { participantCode: candidate, ...row },
          });
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code !== 'P2002') throw err; // not a duplicate — a real failure
          floor = await highestCodeNumber(); // somebody moved the mark; re-read
        }
      }

      if (!created) {
        return NextResponse.json(
          { success: false, error: 'Registration is busy right now. Please tap Register again.' },
          { status: 503 }
        );
      }
      participant = created;
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        participantCode: participant.participantCode,
        name: participant.name,
        schoolName: participant.schoolName,
        language: participant.language,
      },
    });
  } catch (error) {
    console.error('Error registering participant:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

// GET /api/participant — List participants (admin)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get('test');

  const where: Record<string, unknown> = {};
  if (isTest === 'true') where.isTest = true;
  if (isTest === 'false') where.isTest = false;

  try {
    const participants = await db.participant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { round1Attempts: true, round2Attempts: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}
