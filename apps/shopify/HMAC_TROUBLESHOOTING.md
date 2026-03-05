# HMAC Error Troubleshooting Guide

## The Problem
You're getting `{"error":"Invalid HMAC"}` when trying to install/connect the app.

## Root Cause
This happens when your `SHOPIFY_API_SECRET` environment variable doesn't match the secret for your current app.

## Solution Steps

### Step 1: Verify Your Current App Configuration

Check what app you're using:
```bash
shopify app info
```

You should see:
- **Client ID**: `6e550b92f0cbfdf4cf543c83818f20fe`

### Step 2: Get Your API Secret

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to your **SeeItFirst** app
3. Go to **App setup** → **Client credentials**
4. Copy the **Client secret** (this is your `SHOPIFY_API_SECRET`)

### Step 3: Update Environment Variables

#### On Vercel (Production):
1. Go to your Vercel project
2. **Settings** → **Environment Variables**
3. Update these three variables:

```
SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_API_SECRET=<paste_the_secret_from_step_2>
NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
```

4. **Save** and **Redeploy** your app

#### On Local Development (.env.local):
Update your `.env.local` file:

```bash
SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_API_SECRET=<paste_the_secret_from_step_2>
NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_APP_URL=https://shopify.seeitfirst.app
SHOPIFY_SCOPES=read_products,write_products,write_script_tags,write_theme_code,read_themes,write_themes
```

Then restart your dev server:
```bash
npm run dev
```

### Step 4: Verify Environment Variables

After updating, you can check if they're correct by visiting:
```
https://shopify.seeitfirst.app/api/debug/hmac
```

This will show:
- Whether API key and secret are set
- Whether the API key matches the expected value
- Secret length (should be around 32-64 characters)

**⚠️ WARNING**: Remove this debug endpoint in production or secure it!

### Step 5: Test Again

1. Try installing the app again
2. The HMAC error should be resolved

## Common Mistakes

1. **Using old API secret**: If you had a previous app, you might still have the old secret in your environment variables
2. **Not redeploying**: After updating environment variables on Vercel, you must redeploy
3. **Wrong environment**: Make sure you're updating the correct environment (Production, Preview, or Development)
4. **Typo in secret**: Double-check you copied the entire secret correctly

## How HMAC Verification Works

1. Shopify sends an OAuth callback with a `hmac` parameter
2. Your server removes `hmac` and `signature` from the parameters
3. Sorts remaining parameters alphabetically
4. Creates a string: `key1=value1&key2=value2&...` (values are URL-encoded)
5. Calculates HMAC-SHA256 using your `SHOPIFY_API_SECRET`
6. Compares with the `hmac` parameter from Shopify

If they don't match → "Invalid HMAC" error

## Still Not Working?

1. Check server logs for detailed HMAC error messages
2. Verify the secret in Partners Dashboard matches what's in your environment
3. Make sure you're using the correct app (check Client ID)
4. Try uninstalling and reinstalling the app
5. Clear browser cookies and try again

## Security Note

- Never commit `SHOPIFY_API_SECRET` to git
- Never expose it in client-side code
- Only use it in server-side API routes
- The debug endpoint should be removed or secured in production

