import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (process.env.ADVENTURE_PLATFORM_V2 !== 'true') {
    const path = request.nextUrl.pathname;
    const versioned = path.match(/^\/adventure\/v(?:1|2|3|4|5)\/([^/]+)\/?$/);
    if (versioned) { const url = request.nextUrl.clone(); url.pathname = `/adventure/${versioned[1]}`; return NextResponse.redirect(url); }
    if (path.startsWith('/api/widget/') || path.startsWith('/api/instance/')) { const response = NextResponse.next(); response.headers.set('Cache-Control', 'no-store'); return response; }
    return NextResponse.next();
  }
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/platform/')) return NextResponse.next();
  if (path.startsWith('/api/')) return new NextResponse('Legacy API is unavailable in Adventure staging', { status: 410 });
  const versioned = path.match(/^\/adventure\/v[1-5]\/([0-9a-f-]{36})\/?$/i);
  if (versioned) return NextResponse.redirect(new URL(`/adventure/${versioned[1]}`, request.url), 308);
  if (/^\/adventure\/[0-9a-f-]{36}\/?$/i.test(path)) return NextResponse.next();
  return new NextResponse('Adventure staging route is unavailable', { status: 404 });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'] };
