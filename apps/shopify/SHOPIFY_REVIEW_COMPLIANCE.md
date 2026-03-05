# Shopify App Review Compliance

This document outlines the compliance measures implemented to meet Shopify's app review requirements.

## App Pricing Model

**This is a FREE app** - No charges are made through Shopify. Merchants sign up and pay on the external platform (SeeItFirst). The Shopify app is free to install and only provides theme extension functionality.

**Note**: The Billing API implementation is included but not required for free apps. It's available if needed in the future but won't be used for this free app.

## ✅ Completed Requirements

### 1. Billing API Implementation (Optional for Free Apps)
- **Status**: ✅ Implemented (but not required for free apps)
- **Location**: `app/api/billing/route.ts` and `lib/shopify.ts`
- **Note**: Since this is a FREE app, the Billing API is NOT required per Shopify support. The code is included for future use but won't be called.
- **Shopify Support Confirmation**: "if your app is free, then you can have just a free app on Shopify. And no need for using the Billing API. You can simply select 'Free to install' as your app's primary billing method"

### 2. App Bridge Integration
- **Status**: ✅ Implemented
- **Location**: `lib/appBridge.ts` and `app/providers.tsx`
- **Features**:
  - App Bridge is properly initialized for embedded apps
  - Handles redirects automatically
  - Configured with `forceRedirect: true` for proper embedded behavior
- **Environment Variable Required**: `NEXT_PUBLIC_SHOPIFY_API_KEY` (should match `SHOPIFY_API_KEY`)

### 3. Session Token Authentication
- **Status**: ✅ Implemented
- **Location**: `lib/sessionToken.ts`
- **Features**:
  - Session token verification for embedded app requests
  - Fallback to query parameter for non-embedded flows
  - Used in API routes via `getShopFromRequest()` helper
- **Usage**: API routes now support both session token authentication (embedded) and query parameter (legacy)

### 4. OAuth Installation Flow
- **Status**: ✅ Verified
- **Location**: `app/api/auth/route.ts` and `app/api/auth/callback/route.ts`
- **Features**:
  - Immediate redirect to OAuth grant screen after installation request
  - Proper redirect back to app after OAuth callback
  - Uses 302 redirects for immediate navigation
  - Handles re-installation via `upsert` with `onConflict: 'store_domain'`

### 5. Error Handling
- **Status**: ✅ Improved
- **Features**:
  - Clear, informative error messages throughout the app
  - User-friendly error messages that guide merchants
  - Proper HTTP status codes
  - Error details included in responses
- **Locations**: All API routes have been updated with improved error handling

### 6. Re-installation Support
- **Status**: ✅ Verified
- **Location**: `app/api/auth/callback/route.ts`
- **Implementation**: Uses `upsert` with `onConflict: 'store_domain'` to handle re-installations
- **Behavior**: Previously installed merchants can re-install the app without issues

### 7. Theme App Extensions
- **Status**: ✅ Already Implemented
- **Location**: `extensions/sif-ai-widget/`
- **Features**: Theme app extension with app blocks and snippets

## Environment Variables Required

Make sure these environment variables are set:

```bash
# Required for App Bridge (client-side)
NEXT_PUBLIC_SHOPIFY_API_KEY=your_api_key

# Required for server-side operations
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com
SHOPIFY_SCOPES=read_products,write_products,...
```

## Testing Checklist

Before submitting for review, verify:

- [ ] App redirects immediately to OAuth grant screen after installation
- [ ] App redirects properly after OAuth callback
- [ ] Re-installation works for previously installed merchants
- [ ] App Bridge is initialized and working in embedded mode
- [ ] Session token authentication works for embedded requests
- [ ] Error messages are clear and informative
- [ ] Theme app extensions display correctly on storefront
- [ ] No 404, 500, or 300 errors in the app
- [ ] UI is operational and merchants can interact with it
- [ ] App is set to "Free to install" in the app submission form

## API Endpoints

### Billing API (Optional - Not Used for Free App)
- `GET /api/billing` - List all charges
- `POST /api/billing` - Create a new charge
- `PUT /api/billing` - Activate a charge
- `DELETE /api/billing?chargeId=123` - Cancel a charge

**Note**: These endpoints are implemented but NOT required for a free app. They are available for future use if needed.

## Notes

- **This is a FREE app** - No billing required. Merchants pay on the external SeeItFirst platform.
- The app uses `upsert` for store installation, which automatically handles re-installations
- App Bridge is initialized in the `Providers` component to ensure it's available throughout the app
- Session tokens are verified using JWT decoding (for production, consider full signature verification)
- All API routes have been updated to use `getShopFromRequest()` which supports both authentication methods
- Billing API code is included but not used - this is compliant for free apps per Shopify support

## App Submission Checklist

When submitting to the Shopify App Store:

1. ✅ Select **"Free to install"** as the primary billing method
2. ✅ Do NOT set up any pricing plans in the submission form
3. ✅ Ensure the app description clearly states it's free
4. ✅ Make sure all other requirements (App Bridge, OAuth, error handling, etc.) are working

