import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/admin';
import { questionFormSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin question management.
 *
 * Every handler here is gated. Previously GET was open to the world and
 * returned `correctOption` for every question — a student could open
 * /api/admin/questions in a browser tab and read the entire answer key before
 * the round started.
 */

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Admin authentication required' },
    { status: 401 }
  );
}

// GET /api/admin/questions?round=2
export async function GET(request: Request) {
  if (!requireAdmin(request)) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const roundParam = searchParams.get('round');
    const where = roundParam ? { round: Number(roundParam) } : {};

    const questions = await db.question.findMany({
      where,
      orderBy: [{ round: 'asc' }, { questionNumber: 'asc' }],
    });
    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requireAdmin(request)) return unauthorized();

  try {
    const body = await request.json();
    const parsed = questionFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const question = await db.question.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: question });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A question with that number already exists in this round' },
        { status: 409 }
      );
    }
    console.error('Error creating question:', e);
    return NextResponse.json({ success: false, error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!requireAdmin(request)) return unauthorized();

  try {
    const { id, ...data } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    const question = await db.question.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: question });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A question with that number already exists in this round' },
        { status: 409 }
      );
    }
    console.error('Error updating question:', e);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!requireAdmin(request)) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    await db.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
