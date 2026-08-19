import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VERSIONED_ADVENTURE = /^\/adventure\/v(?:1|2|3|4|5|6|7|8)\/([^/]+)\/?$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Versioned adventure URLs are internal-only. Always serve the latest via the
  // canonical unversioned route (Launch / embeds / old bookmarks).
  const versioned = pathname.match(VERSIONED_ADVENTURE);
  if (versioned) {
    const url = request.nextUrl.clone();
    url.pathname = `/adventure/${versioned[1]}`;
    return NextResponse.redirect(url);
  }

  // Only apply to instance bootstrap API routes
  if (pathname.startsWith('/api/widget/') || pathname.startsWith('/api/instance/')) {
    const response = NextResponse.next();

    // Add basic cache control
    response.headers.set('Cache-Control', 'no-store');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/widget/:path*',
    '/api/instance/:path*',
    '/adventure/:path*',
  ],
};
