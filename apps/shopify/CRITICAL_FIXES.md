# Critical Fixes Required

## Issue 1: HMAC Errors (Still Happening)

**Problem**: Your production environment variables are still using the old app's credentials.

**Solution**:
1. Go to Vercel → Your Project → Settings → Environment Variables
2. Update these THREE variables:
   ```
   SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
   SHOPIFY_API_SECRET=<GET FROM PARTNERS DASHBOARD>
   NEXT_PUBLIC_SHOPIFY_API_KEY=6e550b92f0cbfdf4cf543c83818f20fe
   ```
3. **Redeploy** after updating (go to Deployments → Redeploy)

**How to get the secret**:
- https://partners.shopify.com/
- Your SeeItFirst app → App setup → Client credentials → Copy "Client secret"

## Issue 2: "Unsafe Site" Warning from Google

This could be:
1. **SSL Certificate Issue**: Vercel should handle this automatically, but check:
   - Vercel → Your Project → Settings → Domains
   - Make sure `shopify.seeitfirst.app` has a valid SSL certificate
   - Should show "Valid" status

2. **Security Headers Missing**: Add security headers to your Next.js config

3. **Mixed Content**: Make sure all resources load over HTTPS

## Next Steps

1. **First**: Fix the environment variables (Issue 1) - this is blocking OAuth
2. **Then**: Check SSL certificate status in Vercel
3. **Finally**: Add security headers if needed

## Verify After Fixes

1. Check environment variables: `https://shopify.seeitfirst.app/api/debug/hmac`
2. Try OAuth flow again
3. Check SSL: Visit `https://www.ssllabs.com/ssltest/analyze.html?d=shopify.seeitfirst.app`

