import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/register']);
const PROTECTED_PREFIXES = ['/dashboard'];
const INTERNAL_PREFIXES = ['/_next', '/_vercel'];
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || '';

const isStaticAsset = (pathname: string) =>
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf|eot)$/i.test(pathname);

const isInternalOrVerificationRequest = (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;
  const lowerPath = pathname.toLowerCase();
  const lowerSearch = search.toLowerCase();

  return (
    INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    lowerPath.includes('challenge') ||
    lowerSearch.includes('challenge') ||
    pathname === '/favicon.ico' ||
    isStaticAsset(pathname)
  );
};

const isProtectedPath = (pathname: string) => PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never interfere with Vercel verification, Next internals, or static assets.
  if (isInternalOrVerificationRequest(request)) {
    return NextResponse.next();
  }

  // Allow explicitly public routes.
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // This app currently stores auth in localStorage on the client.
  // Only enforce middleware auth when a real auth cookie name is configured.
  if (!AUTH_COOKIE_NAME) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (authCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
