import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types/database'

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth',
  '/',
  '/pricing',
  '/services',
  '/partners',
  '/agency',
  '/test-iframe'
];

// Shopify routes that use Shopify authentication (not Supabase)
const SHOPIFY_ROUTES = [
  '/shopify'
];

// Protected route prefixes that require authentication
const PROTECTED_PREFIXES = [
  '/onboarding',
  '/accounts',
  '/payment-required'
];

// Helper function to check if a path is an account-based route
function isAccountBasedRoute(pathname: string): boolean {
  // Match patterns like /[accountId]/designer-instances, /[accountId]/billing, etc.
  const accountRoutePattern = /^\/[^\/]+\/(designer-instances|billing|contact|users)/;
  return accountRoutePattern.test(pathname);
}

// Helper function to check if a path requires authentication
function requiresAuth(pathname: string): boolean {
  // Check if it's a public route
  if (PUBLIC_ROUTES.includes(pathname)) {
    return false;
  }
  
  // Check if it's a Shopify route (uses Shopify auth, not Supabase)
  if (SHOPIFY_ROUTES.some(prefix => pathname.startsWith(prefix))) {
    return false;
  }
  
  // Check if it matches protected prefixes
  if (PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return true;
  }
  
  // Check if it's an account-based route
  if (isAccountBasedRoute(pathname)) {
    return true;
  }
  
  // Check if it's in the (main) directory - ALL routes in (main) require auth
  if (pathname.startsWith('/(main)') || pathname.includes('/(main)')) {
    return true;
  }
  
  // Check for other protected patterns
  if (pathname.startsWith('/onboarding') || 
      pathname.startsWith('/accounts') || 
      pathname.startsWith('/payment-required')) {
    return true;
  }
  
  return false;
}

export async function middleware(request: NextRequest) {
  try {
    const res = NextResponse.next();
    const pathname = request.nextUrl.pathname;
    // Hard bypass for all API routes, including webhooks and Shopify
    if (pathname.startsWith('/api/')) {
      return res;
    }
    
    // Shopify routes (embedded app): allow but set embed headers
    if (pathname.startsWith('/shopify')) {
      // Allow embedding in Shopify Admin
      res.headers.set('Content-Security-Policy', 'frame-ancestors https://*.myshopify.com https://admin.shopify.com;');
      // X-Frame-Options is ignored when CSP frame-ancestors is present, but some browsers still read it
      res.headers.set('X-Frame-Options', 'ALLOWALL');
      return res;
    }
    
    // Create Supabase client for middleware
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            res.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            res.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );

    // (removed) enterprise intent cookie logic

    // Get user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
    }
    
    // 🔐 If user is not signed in and accessing a protected route → redirect to /auth
    if (!user && requiresAuth(pathname)) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }

    // 👤 If user IS signed in and tries to access /auth → redirect them away
    if (user && pathname === '/auth') {
      return NextResponse.redirect(new URL('/accounts', request.url));
    }

    return res;
  } catch (error) {
    // On error, allow request through
    return NextResponse.next();
  }
}

// Only run middleware on routes that need auth checks
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
} 