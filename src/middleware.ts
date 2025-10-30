import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://client.farcaster.xyz',
  'https://warpcast.com',
  'https://www.warpcast.com',
  'https://staging.warpcast.com',
  process.env.NEXT_PUBLIC_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter(Boolean) as string[];

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin') ?? '';
  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);

  // Reply immediately to preflight checks
  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });

    // Always set these headers for debugging
    preflight.headers.set(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    preflight.headers.set(
      'Access-Control-Allow-Headers',
      request.headers.get('access-control-request-headers') ??
        'Authorization,Content-Type',
    );
    preflight.headers.set('Access-Control-Allow-Credentials', 'true');
    preflight.headers.set('Access-Control-Max-Age', '86400');
    preflight.headers.set('Vary', 'Origin');

    // Only set Allow-Origin if origin is in allowed list
    if (isAllowedOrigin) {
      preflight.headers.set('Access-Control-Allow-Origin', origin);
    }

    return preflight;
  }

  // Let the request through but append CORS headers to the eventual response.
  const response = NextResponse.next();
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
