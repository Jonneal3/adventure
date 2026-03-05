# Quick Start: Submit to Shopify App Store

## Step 1: Create App in Partners Dashboard

1. **Go to Partners Dashboard**: https://partners.shopify.com/
2. Click **Apps** in the left sidebar
3. Click **Create app** button
4. Fill in:
   - **App name**: SeeItFirst
   - **App URL**: `https://shopify.seeitfirst.app`
   - **Allowed redirection URL(s)**: `https://shopify.seeitfirst.app/api/auth/callback`
5. Click **Create app**

## Step 2: Get Your Client ID

1. In your app settings, find the **Client ID** (also called API Key)
2. Copy it - you'll need it for the next step

## Step 3: Update Your Config File

Update `shopify.app.seeitfirst.toml` with your new Client ID:

```toml
client_id = "YOUR_NEW_CLIENT_ID_HERE"
```

## Step 4: Deploy Your App

```bash
shopify app deploy
```

This will deploy your theme app extension.

## Step 5: Submit to App Store

1. In Partners Dashboard, go to your app
2. Click **App Store listing** in the left sidebar
3. Click **Create listing** or **Submit for review**
4. Fill out the form:

### Critical Settings:
- ✅ **Billing method**: Select **"Free to install"**
- ✅ **Do NOT** set up any pricing plans
- ✅ **App URL**: `https://shopify.seeitfirst.app`

### Required Information:
- App name: SeeItFirst
- Short description: "Add SeeItFirst widgets to your Shopify store"
- Long description: Full description of your app
- App icon: 1200x1200px image
- Screenshots: 3-5 screenshots
- Privacy policy URL
- Terms of service URL
- Support email

### Testing Instructions (IMPORTANT):
```
1. Install the app from the App Store
2. After installation, sign in with your SeeItFirst account
3. Go to Online Store → Themes → Customize
4. On a Product page, click "Add block" → App blocks
5. Select "SeeItFirst Button" and save
6. Visit your storefront to see the button

Note: This app is free. No payment required.
```

### Screencast (Recommended):
- Record a 2-3 minute video showing the app installation and setup
- Upload to YouTube (unlisted) and provide the link

## Step 6: Submit

1. Review all information
2. Click **Submit for review**
3. Pay $19 submission fee
4. Wait for review (5-7 business days)

## Direct Link to Create App

**Create App**: https://partners.shopify.com/organizations/YOUR_ORG_ID/apps/new

(Replace YOUR_ORG_ID with your organization ID, or just navigate through the dashboard)

## Need Help?

- **Partners Dashboard**: https://partners.shopify.com/
- **App Store Requirements**: https://shopify.dev/docs/apps/store/requirements

