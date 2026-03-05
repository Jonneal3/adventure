# Environment Variables Update Required

## Current Issue
Your production environment is using the old API key: `62ae9f79cd88fabc064f379643a215a8`

## New API Key
Your new API key (Client ID): `6e550b92f0cbfdf4cf543c83818f20fe`

## Steps to Fix

### 1. Get Your API Secret
1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to your **SeeItFirst** app
3. Go to **App setup** → **Client credentials**
4. Copy the **Client secret** (this is your API secret)

### 2. Update Environment Variables

#### If using Vercel:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Update these variables:

```
SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_API_SECRET=<your_new_api_secret_from_partners_dashboard>
NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
```

4. Click **Save**
5. Go to **Deployments** and click **Redeploy** on the latest deployment

#### If using local development (.env.local):
Update your `.env.local` file:

```bash
SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_API_SECRET=<your_new_api_secret>
NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
SHOPIFY_APP_URL=https://shopify.seeitfirst.app
SHOPIFY_SCOPES=read_products,write_products,write_script_tags,write_theme_code,read_themes,write_themes
```

### 3. Verify
After updating, test the OAuth flow again. The error should be resolved.

## Important Notes
- The `SHOPIFY_API_KEY` and `NEXT_PUBLIC_SHOPIFY_API_KEY` should be the same value (the Client ID)
- The `SHOPIFY_API_SECRET` is different and should be kept secure (never expose it in client-side code)
- After updating environment variables, you may need to restart your local dev server or redeploy on Vercel

