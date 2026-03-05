# OAuth Flow Compliance - Shopify Embedded App Requirements

## ✅ Fixed Implementation

### Problem
The app was checking installation status **client-side**, which meant:
- Page loaded first
- Then checked if installed
- Then redirected to OAuth
- **This violates Shopify's requirement for immediate OAuth redirect**

### Solution
**Server-side middleware** now checks installation status **BEFORE** any page loads:
- Middleware intercepts requests to `/` or `/auth`
- Checks if store is installed (server-side database query)
- If NOT installed: **Immediately redirects to `/api/auth`** (302 redirect)
- If installed: Allows page to load normally

## Current Flow (Compliant)

```
1. Merchant clicks "Install app" in Shopify App Store
   ↓
2. Shopify redirects to: https://your-app.com/?shop=xxx.myshopify.com&host=...
   ↓
3. Middleware intercepts (server-side, BEFORE page load)
   ↓
4. Middleware checks: Is store installed?
   ↓
   ├─ NO → Immediately redirects to /api/auth?shop=... (302)
   │        ↓
   │        /api/auth route redirects to Shopify OAuth grant screen
   │        (This happens server-side, breaks out of iframe automatically)
   │
   └─ YES → Allow page to load
            ↓
            App Bridge initializes
            ↓
            Session token authentication
```

## Key Files

### `middleware.ts` (NEW)
- Server-side check for store installation
- Immediate redirect to `/api/auth` if not installed
- Runs BEFORE any page loads (complies with Shopify requirement)

### `app/api/auth/route.ts`
- Receives redirect from middleware
- Builds OAuth URL with proper parameters
- Server-side 302 redirect to Shopify OAuth grant screen
- Sets OAuth state cookie

### `app/api/auth/callback/route.ts`
- Handles OAuth callback from Shopify
- Exchanges code for access token
- Saves store to database
- Redirects back to app with shop/host params

### `app/page.tsx`
- Now assumes store is installed (middleware already checked)
- Removed client-side install check
- Focuses on UI and session management

## Shopify Requirements Met

✅ **Immediate redirect to OAuth** - Server-side middleware ensures no page loads before OAuth  
✅ **No screens before OAuth grant** - Middleware redirects before React renders  
✅ **Proper OAuth flow** - Uses authorization code grant  
✅ **App Bridge integration** - Initialized after OAuth completes  
✅ **Session token authentication** - Used for embedded API calls  
✅ **Re-installation support** - Uses upsert pattern in callback  

## Testing

1. **First Install:**
   - Uninstall app from test store
   - Install from Shopify App Store
   - Should immediately redirect to OAuth (no page load)
   - After OAuth, should load app

2. **Re-install:**
   - Uninstall and reinstall
   - Should work the same way (upsert handles it)

3. **Already Installed:**
   - Access app when already installed
   - Should load normally (middleware allows through)

## Notes

- Middleware runs on **Edge Runtime** (Next.js default)
- Supabase client works in Edge Runtime
- Server-side redirects automatically break out of iframes
- No client-side JavaScript needed for OAuth redirect

