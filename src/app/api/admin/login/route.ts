import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Simple password hash comparison for demo.
// In production with Supabase, use Supabase Auth.
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    const admin = await db.adminUser.findUnique({ where: { email } });
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const hashedInput = await hashPassword(password);
    if (hashedInput !== admin.password) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // Simple token — in production use JWT or Supabase session
    const token = Buffer.from(`${admin.id}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      token,
      adminName: admin.name,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
