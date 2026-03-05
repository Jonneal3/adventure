# Shopify App Store Submission Guide

## Step 1: Create or Link Your App

You have two options:

### Option A: Create a New App via CLI (Recommended)

```bash
# This will create a new app and update your config
shopify app generate --reset
```

Or if you want to keep your existing config:

```bash
# Create a new app with a specific name
shopify app generate --name "SeeItFirst"
```

### Option B: Link to Existing App in Partners Dashboard

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to **Apps** → **Create app** (or select existing app)
3. Copy the **Client ID** from the app settings
4. Update your `shopify.app.seeitfirst.toml` with the correct client ID
5. Run `shopify app deploy` again

## Step 2: Deploy Your App

Once your app is linked:

```bash
# Deploy the app
shopify app deploy
```

This will:
- Deploy your app extensions (theme app extension)
- Update your app configuration

## Step 3: Submit to App Store via Partners Dashboard

### Access the Submission Page

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Click on your app (SeeItFirst)
3. Navigate to **App Store listing** in the left sidebar
4. Click **Submit for review** or **Create listing**

### Fill Out the Submission Form

#### Basic Information
- **App name**: SeeItFirst
- **Short description**: Brief description (e.g., "Add SeeItFirst widgets to your Shopify store with theme app extensions")
- **Long description**: Detailed description of what your app does
- **App icon**: Upload a 1200x1200px icon
- **Screenshots**: Add 3-5 screenshots showing your app in action

#### Pricing
- **Primary billing method**: Select **"Free to install"** ✅
- **Do NOT** set up any pricing plans (since it's free)
- **Do NOT** configure billing API charges

#### App Details
- **Category**: Select appropriate category (e.g., "Store design" or "Marketing")
- **Tags**: Add relevant tags
- **Support email**: Your support email
- **Privacy policy URL**: Your privacy policy URL
- **Terms of service URL**: Your terms of service URL

#### Testing Instructions
**CRITICAL**: Provide clear testing instructions:

```
Testing Instructions for SeeItFirst App:

1. Install the app from the App Store
2. After installation, you'll be redirected to the app dashboard
3. Sign in with your SeeItFirst account (or create one at seeitfirst.app)
4. Navigate to "Setup Overlay" to configure product image overlays
5. Go to Online Store → Themes → Customize
6. On any Product page, click "Add block" → App blocks
7. Select "SeeItFirst Button" and position it on the page
8. Save the theme
9. Visit a product page on your storefront to see the SeeItFirst button

Test Credentials (if needed):
- Use any Shopify development store
- The app is free and requires no payment
```

#### Screencast (Recommended)
- Record a short video (2-3 minutes) showing:
  - App installation
  - Theme extension setup
  - Widget appearing on storefront
- Upload to YouTube (unlisted) and provide the link

#### App Configuration
- **App URL**: `https://shopify.seeitfirst.app`
- **Allowed redirection URLs**: `https://shopify.seeitfirst.app/api/auth/callback`
- **Webhook URL**: `https://shopify.seeitfirst.app/api/webhooks`

#### Required Scopes
Your app requests these scopes (already configured):
- `read_products`
- `write_products`
- `write_script_tags`
- `write_theme_code`
- `read_themes`
- `write_themes`

Make sure to explain why each scope is needed in the submission form.

## Step 4: Review Checklist

Before submitting, verify:

- [ ] App is set to **"Free to install"**
- [ ] No pricing plans configured
- [ ] App URL is correct and accessible
- [ ] OAuth callback URL is correct
- [ ] Theme app extension is deployed
- [ ] Testing instructions are clear
- [ ] Screencast is uploaded (recommended)
- [ ] Privacy policy and Terms of service URLs are provided
- [ ] All required screenshots are uploaded
- [ ] App icon is uploaded (1200x1200px)

## Step 5: Submit

1. Review all information
2. Click **Submit for review**
3. Pay the $19 submission fee (one-time)
4. Wait for review (typically 5-7 business days)

## Important Notes for Free Apps

- ✅ You do NOT need to use the Billing API (it's implemented but not required)
- ✅ Select "Free to install" as the billing method
- ✅ Do NOT redirect users to external payment pages from the app
- ✅ You can charge users on your external platform (seeitfirst.app) - that's allowed
- ✅ The Shopify app itself must be free

## Troubleshooting

### "No app with client ID found"
- Create a new app via CLI: `shopify app generate --reset`
- Or link to existing app in Partners Dashboard

### "App URL not accessible"
- Make sure your app is deployed and accessible at `https://shopify.seeitfirst.app`
- Check that all environment variables are set correctly

### Submission Rejected
Common reasons:
- Missing testing instructions
- App doesn't work as described
- Missing required information
- Billing issues (if you accidentally set up pricing)

## Direct Links

- **Partners Dashboard**: https://partners.shopify.com/
- **App Store Guidelines**: https://shopify.dev/docs/apps/store/requirements
- **Submission Help**: https://help.shopify.com/en/partners/dashboard/managing-apps/app-store-listing

