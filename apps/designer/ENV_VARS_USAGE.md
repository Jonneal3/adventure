# Shopify Environment Variables Usage

## ✅ YES - All Shopify env vars are actively used in the app!

Here's exactly where each one is used:

---

## 1. `SHOPIFY_CLIENT_ID` - ✅ REQUIRED

**Used in 2 places:**

### `src/lib/shopify.ts` (Line 8)
```typescript
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_CLIENT_ID!,  // ← HERE
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  // ...
});
```
**Purpose:** Initializes the Shopify SDK API client. Without this, OAuth and all Shopify API calls will fail.

### `src/lib/shopify-auth.ts` (Line 28)
```typescript
const result = await verifyRequest({
  sessionToken,
  apiKey: process.env.SHOPIFY_CLIENT_ID!,  // ← HERE
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
});
```
**Purpose:** Verifies that requests from Shopify embedded app are legitimate (security check).

---

## 2. `SHOPIFY_CLIENT_SECRET` - ✅ REQUIRED

**Used in 2 places:**

### `src/lib/shopify.ts` (Line 9)
```typescript
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_CLIENT_ID!,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,  // ← HERE
  // ...
});
```
**Purpose:** Required for OAuth token exchange and signing requests.

### `src/lib/shopify-auth.ts` (Line 29)
```typescript
const result = await verifyRequest({
  sessionToken,
  apiKey: process.env.SHOPIFY_CLIENT_ID!,
  apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET!,  // ← HERE
});
```
**Purpose:** Used to verify session tokens are valid (prevents spoofing).

---

## 3. `SHOPIFY_SCOPES` - ✅ USED (Optional but recommended)

**Used in 3 places:**

### `src/lib/shopify.ts` (Line 10)
```typescript
export const shopify = shopifyApi({
  // ...
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products'],  // ← HERE
  // ...
});
```
**Purpose:** Defines what permissions your app requests during OAuth installation.

### `src/lib/shopify.ts` (Lines 192, 219)
```typescript
// In getShopifyGraphQLClient and getShopifyRESTClient helpers
const session = {
  // ...
  scope: process.env.SHOPIFY_SCOPES || 'read_products,write_products',  // ← HERE
};
```
**Purpose:** Used when creating API clients from stored tokens.

**Default if not set:** `['read_products']`

---

## 4. `SHOPIFY_APP_URL` - ✅ USED (Optional, has fallback)

**Used in 1 place:**

### `src/lib/shopify.ts` (Line 11)
```typescript
export const shopify = shopifyApi({
  // ...
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '')  // ← HERE
    || process.env.NEXT_PUBLIC_SITE_URL?.replace(/https?:\/\//, '') 
    || 'localhost:3000',
});
```
**Purpose:** Tells Shopify SDK where your app is hosted. Used for OAuth redirect URLs.

**Fallback:** Uses `NEXT_PUBLIC_SITE_URL` if not set, then defaults to `localhost:3000`

---

## 5. `NEXT_PUBLIC_SITE_URL` - ✅ USED (Required for widget)

**Used in 2 places:**

### `src/lib/shopify.ts` (Line 11)
```typescript
hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') 
  || process.env.NEXT_PUBLIC_SITE_URL?.replace(/https?:\/\//, '')  // ← HERE (fallback)
  || 'localhost:3000',
```
**Purpose:** Fallback for `SHOPIFY_APP_URL` in Shopify SDK config.

### `app/api/shopify/app-block/route.ts`
```typescript
// Get site URL from environment
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000';  // ← HERE
const widgetUrl = `${siteUrl}/widget.js`;
```
**Purpose:** **CRITICAL** - This is where `widget.js` is loaded from in Shopify App Blocks. Without this, the widget won't load!

---

## Summary

| Variable | Required? | Used Where | Purpose |
|----------|-----------|-----------|---------|
| `SHOPIFY_CLIENT_ID` | ✅ **YES** | `shopify.ts`, `shopify-auth.ts` | Initialize SDK, verify requests |
| `SHOPIFY_CLIENT_SECRET` | ✅ **YES** | `shopify.ts`, `shopify-auth.ts` | OAuth token exchange, security |
| `SHOPIFY_SCOPES` | ⚠️ Optional | `shopify.ts` | Define OAuth permissions |
| `SHOPIFY_APP_URL` | ⚠️ Optional | `shopify.ts` | OAuth redirect URLs (has fallback) |
| `NEXT_PUBLIC_SITE_URL` | ✅ **YES** | `shopify.ts`, `app-block/route.ts` | Widget.js loading, fallback URL |

---

## What Happens If Missing?

### Missing `SHOPIFY_CLIENT_ID` or `SHOPIFY_CLIENT_SECRET`
- ❌ App will **crash on startup** (the `!` means required)
- ❌ OAuth flow won't work
- ❌ No API calls possible

### Missing `SHOPIFY_SCOPES`
- ⚠️ Uses default: `['read_products']`
- ⚠️ Won't have write access if needed

### Missing `SHOPIFY_APP_URL`
- ⚠️ Falls back to `NEXT_PUBLIC_SITE_URL`
- ⚠️ If that's also missing, defaults to `localhost:3000`

### Missing `NEXT_PUBLIC_SITE_URL`
- ❌ **Widget won't load** in Shopify App Blocks!
- ❌ App Block will use `https://localhost:3000/widget.js` (broken)

---

## Recommended `.env.local` Setup

```env
# REQUIRED - From Partner Dashboard
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here

# OPTIONAL - Define scopes (defaults to ['read_products'] if not set)
# SHOPIFY_SCOPES=read_products,write_products

# OPTIONAL - App URL (has fallback to NEXT_PUBLIC_SITE_URL)
SHOPIFY_APP_URL=http://localhost:3000
# OR for production: https://yourdomain.com

# REQUIRED - For widget.js loading
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# OR for production: https://yourdomain.com
```

---

## Testing If Variables Are Loaded

Start your dev server and check logs:
```bash
npm run dev
```

If variables are missing, you'll see errors like:
- `SHOPIFY_API_KEY is required`
- App crashes on startup

If everything is set, the app should start normally.

