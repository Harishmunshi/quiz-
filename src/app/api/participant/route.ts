import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { registerParticipantSchema } from '@/lib/validation/schemas';

// POST /api/participant — Register a new participant
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerParticipantSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
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

    // Generate unique participant code
    const count = await db.participant.count();
    const code = `MES${String(count + 1).padStart(4, '0')}`;

    const participant = await db.participant.create({
      data: {
        participantCode: code,
        name: parsed.data.name,
        className: parsed.data.className,
        division: parsed.data.division,
        language: parsed.data.language,
        isTest: settings.isTestMode,
      },
    });

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        participantCode: participant.participantCode,
        name: participant.name,
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
