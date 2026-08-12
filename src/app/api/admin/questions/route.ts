import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const questions = await db.question.findMany({
      orderBy: [{ round: 'asc' }, { questionNumber: 'asc' }],
    });
    return NextResponse.json({ success: true, data: questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = await db.question.create({ data: body });
    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json({ success: false, error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const question = await db.question.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
