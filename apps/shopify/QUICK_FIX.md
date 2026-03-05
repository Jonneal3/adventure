# Quick Fix Guide

## Step 1: Check Your Environment Variables

Visit this URL to see what's wrong:
```
https://shopify.seeitfirst.app/api/debug/errors
```

This will show you exactly what environment variables are missing or incorrect.

## Step 2: Fix Environment Variables in Vercel

1. **Get your API Secret:**
   - Go to: https://partners.shopify.com/
   - Your SeeItFirst app → App setup → Client credentials
   - Copy the "Client secret"

2. **Update in Vercel:**
   - Vercel → Your Project → Settings → Environment Variables
   - **Make sure you're editing the PRODUCTION environment**
   - Update these three:
     ```
     SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
     SHOPIFY_API_SECRET=<paste_secret_from_step_1>
     NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
     ```
   - Click **Save**

3. **Redeploy:**
   - Go to Deployments tab
   - Click the three dots (⋯) on the latest deployment
   - Click **Redeploy**

## Step 3: Verify

After redeploying, visit:
```
https://shopify.seeitfirst.app/api/debug/errors
```

Should show `"status": "OK"` if everything is correct.

## Step 4: Test OAuth Again

Try installing the app again. The OAuth should work now.

## For Google "Dangerous Site" Warning

1. **Check SSL:** Vercel → Settings → Domains → Verify SSL is valid
2. **Wait 24-48 hours** for Google to re-crawl after deployment
3. **Check Safe Browsing:** https://transparencyreport.google.com/safe-browsing/search?url=shopify.seeitfirst.app
4. **Submit to Search Console** if needed

The security headers are already added and will help once Google re-crawls.

