# Diagnostic Guide for OAuth and Security Issues

## Issue 1: Google "Dangerous Site" Warning

### Quick Checks:

1. **Check SSL Certificate:**
   - Go to Vercel → Your Project → Settings → Domains
   - Verify `shopify.seeitfirst.app` has a valid SSL certificate
   - Should show green checkmark

2. **Test Security Headers:**
   - Visit: https://securityheaders.com/?q=https://shopify.seeitfirst.app
   - Should show A or B rating after deployment

3. **Check Google Safe Browsing:**
   - Visit: https://transparencyreport.google.com/safe-browsing/search?url=shopify.seeitfirst.app
   - If flagged, request a review

4. **Verify HTTPS:**
   - Make sure all resources load over HTTPS
   - Check browser console for mixed content warnings

### Fix Steps:

1. **Redeploy with security headers** (already added to `next.config.mjs`)
2. **Wait 24-48 hours** for Google to re-crawl
3. **Submit to Google Search Console** if needed

## Issue 2: OAuth Callback Errors

### To See Actual Error Messages:

1. **In Vercel Dashboard:**
   - Go to your project → Logs
   - Filter by: `/api/auth/callback`
   - Look for lines with `error` or `warning` level
   - Copy the actual error message

2. **Or Check Debug Endpoint:**
   - Visit: `https://shopify.seeitfirst.app/api/debug/hmac`
   - This shows if environment variables are set correctly

### Most Common Issue:

**Environment variables not updated in Vercel**

### Fix:

1. **Get your API Secret:**
   - Go to: https://partners.shopify.com/
   - Your SeeItFirst app → App setup → Client credentials
   - Copy the "Client secret"

2. **Update in Vercel:**
   - Vercel → Your Project → Settings → Environment Variables
   - Update these THREE variables:
     ```
     SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
     SHOPIFY_API_SECRET=<paste_secret_here>
     NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
     ```
   - **Important:** Make sure you're updating the **Production** environment
   - Click **Save**

3. **Redeploy:**
   - Go to Deployments
   - Click the three dots on the latest deployment
   - Click **Redeploy**
   - OR push a new commit to trigger redeploy

4. **Verify:**
   - Visit: `https://shopify.seeitfirst.app/api/debug/hmac`
   - Should show `apiKeyMatches: true` and `hasSecret: true`

### If Still Failing:

Check the Vercel logs for the actual error message. The enhanced logging will show:
- Whether API key matches
- Whether secret is set
- Secret length
- More diagnostic info

