# OAuth Iframe Redirect Fix

## Problem
When redirecting to OAuth in an embedded iframe, the browser shows "accounts.shopify.com refused to connect" because OAuth pages cannot load in iframes.

## Root Cause
Server-side redirects (302) should automatically break out of iframes, but there might be edge cases where the redirect context matters.

## Solution

### 1. Middleware (Server-Side Check)
- Checks if store is installed **before any page loads**
- If not installed, redirects to `/api/auth` (server-side 302)
- This happens **before React renders**, ensuring compliance

### 2. `/api/auth` Route (Server-Side Redirect)
- Receives redirect from middleware
- Builds OAuth URL: `https://{shop}.myshopify.com/admin/oauth/authorize?...`
- Server-side 302 redirect to OAuth URL
- Added `X-Frame-Options: DENY` header to ensure OAuth page doesn't load in iframe

### 3. How It Works
```
Embedded iframe context:
  ↓
Middleware intercepts (server-side)
  ↓
Redirects to /api/auth (302, server-side)
  ↓
/api/auth redirects to Shopify OAuth (302, server-side)
  ↓
Browser receives 302 to external URL (shop.myshopify.com)
  ↓
Browser automatically breaks out of iframe (external redirect)
  ↓
OAuth page loads in top-level window ✅
```

## Why This Works

1. **Server-side redirects** (302) to external URLs automatically break out of iframes
2. **X-Frame-Options: DENY** header ensures OAuth page won't load in iframe even if somehow redirected there
3. **No client-side JavaScript** needed for the redirect - all server-side

## Testing

After deploying:
1. Install app from Shopify App Store
2. Should immediately redirect to OAuth (no page load, no button)
3. OAuth should load in top-level window (not iframe)
4. After OAuth, redirects back to app in iframe

## Notes

- Middleware runs on Edge Runtime (works with Supabase)
- All redirects are server-side (302 status)
- External redirects (to shop.myshopify.com) automatically break out of iframes
- X-Frame-Options header provides additional protection

