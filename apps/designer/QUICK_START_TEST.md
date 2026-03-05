# Quick Start Testing Guide

## Step 1: Apply Database Migration ⚡

```bash
# Option A: Using Supabase CLI (if linked)
npm run db:push

# Option B: Manual - Copy SQL and run in Supabase Dashboard
# File: supabase/migrations/20250130000000_create_shopify_tables.sql
```

**Verify:**
- Go to Supabase Dashboard → Table Editor
- Check `shopify_stores` table exists
- Check `accounts_shopify` table exists

---

## Step 2: Set Environment Variables

Make sure `.env.local` has:

```env
# REQUIRED - Get from Shopify Partner Dashboard → App Setup → Client credentials
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=your_client_secret_here

# REQUIRED - For widget.js loading
NEXT_PUBLIC_SITE_URL=https://adventure.app

# OPTIONAL - Only if using different URL for Shopify OAuth
# SHOPIFY_APP_URL=https://adventure.app
```

---

## Step 3: Start Dev Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

---

## Step 4: Configure Shopify Partner Dashboard

1. Go to https://partners.shopify.com
2. Open your app → **App Setup** (or create version)
3. Configure:

### App URL
```
https://adventure.app/shopify/app
```

### Redirect URLs
```
https://adventure.app/api/shopify/auth/callback,https://adventure.app/shopify/app
```

### Scopes (Required)
```
read_products,write_products
```

### Other Settings
- ✅ **Embed app in Shopify admin**: YES
- **Webhooks API Version**: 2025-10
- **Preferences URL**: (leave blank)

4. **Save** the configuration
5. Copy **Client ID** and **Client Secret** to `.env.local`
6. **Restart dev server** after updating `.env.local`

---

## Step 5: Test OAuth Installation

### Option A: Direct URL
Navigate to:
```
https://adventure.app/api/shopify/auth?shop=YOUR-STORE.myshopify.com
```
*(Replace `YOUR-STORE` with your development store name)*

### Option B: Via Partner Dashboard
1. Go to Partner Dashboard → Your App
2. Click "Test on development store"
3. Select your development store
4. Click "Install"

**Expected Flow:**
1. ✅ Redirects to Shopify OAuth consent screen
2. ✅ Click "Install app" or "Allow"
3. ✅ Redirects back to `/shopify/app?shop=...`
4. ✅ App loads in Shopify admin iframe

---

## Step 6: Test Account Linking

After OAuth, you should be on `/shopify/app`:

1. **Login** (if not already logged in)
   - Click "Go to Login"
   - Login with your Supabase account

2. **Link Account**
   - See list of your accounts
   - Click "Link" on an account
   - ✅ Should redirect to `/shopify/app/configure`

---

## Step 7: Test Configuration Page

At `/shopify/app/configure`:

1. **Verify Display**
   - ✅ Shows linked account name
   - ✅ Shows Shopify store name
   - ✅ Lists all instances for the account

2. **Test Instance Selection**
   - Click on an instance card
   - ✅ Instance gets highlighted
   - ✅ Instance ID displayed
   - ✅ "Copy" button works

---

## Step 8: Test APIs Directly

### Test Instance Config API
```bash
curl "https://adventure.app/api/shopify/instance-config?shop=YOUR-STORE.myshopify.com&instanceId=YOUR_INSTANCE_ID"
```

**Expected:** Returns JSON with instance config

### Test App Block Endpoint
```bash
curl "https://adventure.app/api/shopify/app-block"
```

**Expected:** Returns Liquid template

### Test Instances API
```bash
# Get auth token from browser DevTools → Network tab → Request Headers → Authorization
curl "https://adventure.app/api/shopify/instances?shop=YOUR-STORE.myshopify.com" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Returns JSON with instances array

---

## Step 9: Test Widget.js (Optional)

Create `test-widget.html` in project root:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Widget Test</title>
  <script src="https://adventure.app/widget.js"></script>
</head>
<body>
  <h1>Widget Test</h1>
  <div 
    id="sif-widget-test" 
    data-shop="YOUR-STORE.myshopify.com"
    data-instance-id="YOUR_INSTANCE_ID"
    data-product-id="123"
    style="width: 500px; height: 600px; border: 1px solid #ccc;">
  </div>
</body>
</html>
```

Open in browser → Check console for errors

---

## Step 10: Register App Block (Production Step)

**Note:** App Blocks can only be tested in a real Shopify store, not localhost.

1. **In Partner Dashboard**
   - Go to **App Setup** → **App Blocks**
   - Click **Create App Block**
   - Configure:
     - **Name**: "Adventure Widget"
     - **Template URL**: `https://adventure.app/api/shopify/app-block`
     - **Settings Schema**:
     ```json
     {
       "settings": [
         {
           "type": "text",
           "id": "instance_id",
           "label": "Widget Instance ID"
         }
       ]
     }
     ```
   - Save

2. **In Theme Customizer**
   - Go to your dev store
   - **Online Store → Themes → Customize**
   - Go to a product page
   - Click **Add block**
   - Find **Adventure Widget**
   - Add and enter instance ID
   - Save

3. **View Product Page**
   - Navigate to any product
   - ✅ Widget should appear where block is placed

---

## Troubleshooting

### OAuth Redirect Fails
- Check Redirect URLs in Partner Dashboard match exactly
- Verify `SHOPIFY_APP_URL` or `NEXT_PUBLIC_SITE_URL` matches
- Check console for CORS errors

### "Invalid session token"
- Verify `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are correct
- Check they match Partner Dashboard credentials
- Restart dev server after updating `.env.local`

### "Store not found"
- Verify OAuth completed successfully
- Check `shopify_stores` table in Supabase
- Verify store domain format (should include `.myshopify.com`)

### Widget doesn't load
- Check `NEXT_PUBLIC_SITE_URL` is set correctly
- Verify instance ID is correct
- Check browser console for errors
- Verify CORS headers in API response

### Account linking fails
- Verify you're logged into Supabase
- Check account exists in `accounts` table
- Verify user has access to account (in `user_accounts` table)

---

## Quick Checklist

- [ ] Database migration applied
- [ ] Environment variables set
- [ ] Dev server running
- [ ] Partner Dashboard configured
- [ ] OAuth installation works
- [ ] Token stored in database
- [ ] Account linking works
- [ ] Configuration page shows instances
- [ ] Instance selection works
- [ ] APIs return data
- [ ] Widget.js loads (test file)

---

## Next Steps

Once local testing works:

1. Deploy to production (Vercel, etc.)
2. Update Partner Dashboard URLs to production domain
3. Test in real Shopify store
4. Register App Block in production
5. Test full widget flow on product pages

---

## Using ngrok for Better Testing

Shopify may restrict `localhost`. Use ngrok:

```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 3000

# Use the HTTPS URL in:
# - Partner Dashboard URLs
# - SHOPIFY_APP_URL
# - NEXT_PUBLIC_SITE_URL
```

Example:
```
https://abc123.ngrok.io/shopify/app
https://abc123.ngrok.io/api/shopify/auth/callback
```
