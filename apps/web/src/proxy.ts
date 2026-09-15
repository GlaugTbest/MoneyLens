import { NextRequest, NextResponse } from 'next/server';

// O access token dura só 15min — usamos a presença do refresh token (7d)
// como sinal de sessão aqui; o apiFetch do cliente renova o access token
// sob demanda (ver lib/api.ts) quando uma chamada à API volta 401.
const REFRESH_TOKEN_COOKIE = 'ml_refresh_token';
const PROTECTED_PREFIXES = ['/dashboard', '/connections', '/transactions', '/insights'];

// Optimistic check only (presence of the cookie, not signature/expiry) — the
// real verification happens on every API request via the NestJS JwtAuthGuard.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_TOKEN_COOKIE);

  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasSession ? '/dashboard' : '/login', req.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
