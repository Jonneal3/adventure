# Installation Flow Fix

## Problem
The app was showing a "Connect to SeeItFirst" button when first installed, requiring users to click it before OAuth would start. This violates Shopify's requirement that apps **immediately redirect to the OAuth grant screen** upon installation.

## Solution
Changed the installation flow to **automatically redirect** to OAuth when the store is not installed, instead of showing a button.

## Changes Made

### `app/page.tsx`
- **Before**: Checked if store was installed, then showed a button if not installed
- **After**: Checks if store is installed, and **immediately redirects** to `/api/auth` if not installed
- The button is now only shown as a fallback if the redirect somehow fails

## How It Works Now

1. **User installs app from Shopify App Store**
2. **Shopify redirects to app URL** with `shop` and `host` parameters
3. **App checks if store is installed** (calls `/api/debug/shopify-store`)
4. **If not installed**: Immediately redirects to `/api/auth?shop=...`
5. **`/api/auth` route**: Server-side redirects to Shopify OAuth grant screen
6. **After OAuth**: Shopify redirects back to `/api/auth/callback`
7. **Callback**: Exchanges token, saves store, redirects back to app
8. **App loads**: Now installed, shows main UI

## Benefits

✅ **Compliant with Shopify requirements** - Immediate redirect to OAuth  
✅ **Smoother UX** - No button click required  
✅ **No separate tab** - Redirects in same tab/frame  
✅ **Fallback button** - Still available if redirect fails

## Testing

After deploying, test:
1. Uninstall the app from a test store
2. Install the app again from Shopify App Store
3. Should immediately redirect to OAuth grant screen (no button shown)
4. After granting permissions, should redirect back to app
5. App should load normally

## Notes

- The redirect uses `window.location.href` which works in both embedded and non-embedded contexts
- App Bridge's `forceRedirect: true` helps ensure proper redirects in embedded mode
- The button is kept as a fallback in case the automatic redirect fails for any reason

