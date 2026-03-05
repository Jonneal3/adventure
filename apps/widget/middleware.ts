import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to instance bootstrap API routes
  if (request.nextUrl.pathname.startsWith('/api/widget/') || request.nextUrl.pathname.startsWith('/api/instance/')) {
    const response = NextResponse.next();
    
    // Add basic cache control
    response.headers.set('Cache-Control', 'no-store');
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/widget/:path*', '/api/instance/:path*'],
}; 
