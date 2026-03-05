# OAuth State Cookie Fix

## Problem
On fresh installs, the OAuth callback was failing with "Invalid OAuth state" because the state cookie wasn't being sent back when Shopify redirected to the callback URL.

## Root Cause
The cookie was being set using `cookies().set()`, but when immediately redirecting to Shopify OAuth, the cookie wasn't properly included in the redirect response's Set-Cookie header.

## Solution

### 1. Set Cookie on Redirect Response
Changed from:
```typescript
cookies().set('shopify_oauth_state', state, {...});
const response = NextResponse.redirect(url, { status: 302 });
```

To:
```typescript
const response = NextResponse.redirect(url, { status: 302 });
response.cookies.set('shopify_oauth_state', state, {...});
```

This ensures the cookie is included in the redirect response's Set-Cookie header.

### 2. Cookie Settings for Cross-Site Redirects
For the OAuth flow (our app → Shopify → back to our app), we need:
- **SameSite=None** - Allows cookie to be sent on cross-site requests
- **Secure=true** - Required when SameSite=None (HTTPS only)
- **httpOnly=true** - Prevents JavaScript access (security)
- **path=/** - Available on all paths
- **maxAge=600** - 10 minutes (OAuth should complete quickly)

### 3. Enhanced Logging
Added detailed logging in the callback to debug state mismatches:
- Whether cookie exists
- Cookie length
- State from Shopify length
- Whether they match

## How It Works Now

```
1. Middleware redirects to /api/auth
   ↓
2. /api/auth sets cookie on redirect response
   ↓
3. Browser receives redirect + Set-Cookie header
   ↓
4. Browser stores cookie (SameSite=None allows cross-site)
   ↓
5. Browser redirects to Shopify OAuth
   ↓
6. Merchant approves
   ↓
7. Shopify redirects back to /api/auth/callback
   ↓
8. Browser sends cookie (SameSite=None allows this)
   ↓
9. Callback verifies state matches ✅
```

## Testing

After deploying:
1. Uninstall app from test store
2. Install app from Shopify App Store
3. Should redirect to OAuth immediately
4. After approving, should complete successfully
5. Check Vercel logs for `[auth GET] oauth_initiated` and `[shopify_auth_callback] state_check`

## Environment Variables

Ensure these are set in Vercel:
- `SHOPIFY_OAUTH_SAMESITE=none` (default, but can be set explicitly)
- `SHOPIFY_OAUTH_SECURE=true` (default, but can be set explicitly)

## Notes

- The cookie must be set on the redirect response object, not before creating it
- SameSite=None requires Secure=true (HTTPS)
- The cookie persists through the redirect chain because SameSite=None allows cross-site sending
- maxAge ensures the cookie doesn't expire during the OAuth flow

