# Environment Variables Checklist

## Required Updates for Your .env.local File

### 1. Shopify API Key (UPDATE THIS)
```bash
SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
```

### 2. Shopify API Secret (GET FROM PARTNERS DASHBOARD)
```bash
SHOPIFY_API_SECRET=<GET THIS FROM PARTNERS DASHBOARD>
```
**How to get it:**
1. Go to https://partners.shopify.com/
2. Navigate to your **SeeItFirst** app
3. Go to **App setup** → **Client credentials**
4. Copy the **Client secret** (this is your `SHOPIFY_API_SECRET`)

### 3. Public API Key (UPDATE THIS)
```bash
NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
```
**Note:** This should be the same as `SHOPIFY_API_KEY`

### 4. App URL (Should already be correct)
```bash
SHOPIFY_APP_URL=https://shopify.seeitfirst.app
```

### 5. Scopes (Should already be correct)
```bash
SHOPIFY_SCOPES=read_products,write_products,write_script_tags,write_theme_code,read_themes,write_themes
```

### 6. API Version (Should already be correct)
```bash
SHOPIFY_API_VERSION=2025-10
```

## Quick Fix Steps

1. **Open your `.env.local` file**
2. **Update these three lines:**
   - `SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe`
   - `SHOPIFY_API_SECRET=<paste_new_secret_here>`
   - `NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe`
3. **Save the file**
4. **Restart your dev server** (if running locally)

## Also Update in Vercel

Don't forget to update these same variables in Vercel:
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Update the three variables above
3. Redeploy

## Verify It's Working

After updating, you can check:
- Local: Restart dev server and try OAuth
- Production: Visit `https://shopify.seeitfirst.app/api/debug/hmac` to verify environment variables

