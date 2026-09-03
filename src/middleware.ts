import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge-safe gate. It only checks that a session cookie exists so that anonymous
 * visitors are bounced to /login quickly; the real authorisation (role checks,
 * ownership checks) always happens again on the server in
 * src/server/auth-guards.ts. Never trust this file alone.
 */
const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/_next', '/favicon.ico', '/icon.svg'];

const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?callbackUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|login|api/auth).*)'],
};
