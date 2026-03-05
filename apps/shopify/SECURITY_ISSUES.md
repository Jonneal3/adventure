# Security and OAuth Issues

## Issue 1: Google "Dangerous Site" Warning

### Possible Causes:
1. **Missing or invalid SSL certificate** - Vercel should handle this automatically
2. **Security headers not properly configured**
3. **Google Safe Browsing flag** - Site may have been flagged
4. **Mixed content** - HTTP resources on HTTPS page

### Solutions:

#### 1. Check SSL Certificate in Vercel
- Go to Vercel → Your Project → Settings → Domains
- Verify `shopify.seeitfirst.app` shows "Valid" SSL status
- If not valid, Vercel should auto-renew it

#### 2. Verify Security Headers
The security headers are already added in `next.config.mjs`. After deployment, verify they're working:
- Visit: https://securityheaders.com/?q=https://shopify.seeitfirst.app
- Should show A or B rating

#### 3. Check Google Safe Browsing
- Visit: https://transparencyreport.google.com/safe-browsing/search?url=shopify.seeitfirst.app
- If flagged, you may need to request a review

#### 4. Submit to Google Search Console
- Add your domain to Google Search Console
- Request indexing
- This can help clear false positives

## Issue 2: OAuth Callback Errors

The logs show many callback attempts. We need to see the actual error messages. 

### Check Vercel Logs:
1. Go to Vercel → Your Project → Logs
2. Filter by `/api/auth/callback`
3. Look for error messages like:
   - `invalid_hmac`
   - `Token exchange failed`
   - `state_mismatch`

### Most Likely Cause:
**Environment variables not updated in Vercel**

### Fix:
1. Go to Vercel → Settings → Environment Variables
2. Update:
   - `SHOPIFY_API_KEY` = `6e550b92f0cbfdf4cf543c83818f20fe`
   - `SHOPIFY_API_SECRET` = (get from Partners Dashboard)
   - `NEXT_PUBLIC_SHOPIFY_API_KEY` = `6e550b92f0cbfdf4cf543c83818f20fe`
3. **Redeploy** after updating

### Verify Environment Variables:
Visit: `https://shopify.seeitfirst.app/api/debug/hmac`

This will show if your environment variables are correctly set.

