import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed admin tokens.
 *
 * The original implementation issued `base64(adminId:timestamp)` and never
 * verified it. Anyone could forge a token — or simply POST directly to an
 * admin endpoint with no token at all — and take control of the competition
 * mid-event. These helpers make the token unforgeable without JWT_SECRET.
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — comfortably longer than an event

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 8) {
    // Fail loudly in prod rather than silently accepting a weak secret.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set. Admin auth cannot be secured.');
    }
    return 'insecure-dev-secret';
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export interface AdminTokenPayload {
  sub: string; // admin id
  name: string;
  iat: number;
  exp: number;
}

export function signAdminToken(adminId: string, name: string): string {
  const now = Date.now();
  const payload: AdminTokenPayload = {
    sub: adminId,
    name,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined): AdminTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret()).update(body).digest());

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as AdminTokenPayload;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract the token from an incoming request (Authorization header or x-admin-token). */
export function tokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-admin-token');
}

/** Returns the admin payload, or null when the caller is not a valid admin. */
export function requireAdmin(request: Request): AdminTokenPayload | null {
  return verifyAdminToken(tokenFromRequest(request));
}
