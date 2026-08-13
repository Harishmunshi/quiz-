import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signAdminToken } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    const admin = await db.adminUser.findUnique({ where: { email } });

    // Hash regardless of whether the user exists so response time doesn't
    // reveal which emails are registered.
    const hashedInput = await hashPassword(password);

    if (!admin || hashedInput !== admin.password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // HMAC-signed and time-limited. The previous token was plain
    // base64("id:timestamp") and was never verified by any endpoint, so anyone
    // could mint one and seize control of the competition mid-event.
    const token = signAdminToken(admin.id, admin.name);

    return NextResponse.json({ success: true, token, adminName: admin.name });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
