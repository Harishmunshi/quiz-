import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const challenges = await db.round2Challenge.findMany({
      orderBy: { challengeNumber: 'asc' },
    });
    return NextResponse.json({ success: true, data: challenges });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...data } = await request.json();
    if (data.items) data.items = JSON.stringify(data.items);
    if (data.correctOrder) data.correctOrder = JSON.stringify(data.correctOrder);
    const challenge = await db.round2Challenge.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: challenge });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    await db.round2Challenge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
