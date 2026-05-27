import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Paths that belong to the authenticated (app) route group.
 * Any request starting with these prefixes requires a session.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/events', '/admin'];

/**
 * Paths that require the ADMIN role.
 */
const ADMIN_PREFIXES = ['/admin'];

/**
 * Returns true if the pathname matches a protected route.
 */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

/**
 * Returns true if the pathname requires admin role.
 */
function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}

/**
 * A session is considered present when at least one of the auth cookies exists:
 *   - access_token  → active, unexpired session
 *   - refresh_token → access token expired but a transparent refresh will happen
 *                     on the first 401 from the API client (api.ts)
 *
 * We intentionally do NOT verify the JWT signature here — that happens on the
 * API server. The middleware's job is only to prevent the browser from
 * rendering the full app shell for unauthenticated visitors.
 */
function hasSession(request: NextRequest): boolean {
  return (
    request.cookies.has('access_token') || request.cookies.has('refresh_token')
  );
}

/**
 * Decodes the `role` claim from the access_token JWT without verifying the
 * signature. Role verification is still enforced by the API server on every
 * request; this check is a fast client-side guard to avoid showing the admin
 * shell to non-admin users.
 *
 * Returns null when the token is absent, malformed, or contains no role.
 *
 * NOTE: Uses `atob` (Web API) instead of `Buffer` because middleware runs on
 * the Next.js Edge Runtime which does not include Node.js built-ins.
 */
function getRoleFromAccessToken(request: NextRequest): string | null {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → standard base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for non-protected routes
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // 2. No session at all → redirect to /login
  if (!hasSession(request)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Admin-only routes: check role when access_token is present.
  //    If only refresh_token is present (access token just expired), let
  //    the request through — the page's API calls will return 403 and the
  //    admin page renders no sensitive data without a valid token anyway.
  if (isAdminRoute(pathname)) {
    const role = getRoleFromAccessToken(request);
    if (role !== null && role !== 'ADMIN') {
      // Authenticated but not an admin → redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Match all routes EXCEPT:
   *   - Next.js internals (_next/static, _next/image)
   *   - Static assets (favicon, images)
   * This lets the middleware run on every app route without overhead on assets.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
