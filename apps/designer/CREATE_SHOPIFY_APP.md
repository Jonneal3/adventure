# Creating Your Shopify App (Step by Step)

If you deleted your app in Partner Dashboard, here's how to recreate it:

---

## Step 1: Create New App

1. Go to https://partners.shopify.com
2. Click **Apps** in left sidebar
3. Click **Create app**
4. Choose **Custom app** (not Public app)
5. Enter app name: `adventure` (or whatever you want)
6. Click **Create app**

---

## Step 2: Configure App Settings

1. **App Setup** section (should be selected by default)

### App URL
```
https://adventure.app/shopify/app
```

### Preferences URL (Optional)
Leave blank or use same as App URL

### ✅ Embed app in Shopify admin
**CHECK THIS BOX** - Required!

---

## Step 3: Configure Redirect URLs

In the **Redirect URLs** field, enter (comma-separated, no spaces):
```
https://adventure.app/api/shopify/auth/callback,https://adventure.app/shopify/app
```

---

## Step 4: Configure Scopes

### Required Scopes
Enter:
```
read_products,write_products
```

### Optional Scopes
Leave blank

---

## Step 5: Other Settings

- **Webhooks API Version**: `2025-10` (or latest)
- **Use legacy install flow**: Leave unchecked
- **App Proxy**: Leave unchecked

---

## Step 6: Get Client Credentials

1. Still in **App Setup** section
2. Scroll down to **Client credentials**
3. You'll see:
   - **Client ID** (or **API key**)
   - **Client secret** (or **API secret key**)

4. Copy these to your `.env.local`:
   ```env
   SHOPIFY_CLIENT_ID=paste_client_id_here
   SHOPIFY_CLIENT_SECRET=paste_client_secret_here
   NEXT_PUBLIC_SITE_URL=https://adventure.app
   ```

---

## Step 7: Save and Test

1. **Save** all changes in Partner Dashboard
2. Make sure your `.env.local` has:
   ```env
   SHOPIFY_CLIENT_ID=your_new_client_id
   SHOPIFY_CLIENT_SECRET=your_new_client_secret
   NEXT_PUBLIC_SITE_URL=https://adventure.app
   ```
3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

---

## Step 8: Create App Version (if needed)

Some Partner Dashboard interfaces require creating a version:

1. Click **Releases** or **Versions** tab
2. Click **Create version**
3. **Based on**: Select your base version
4. **Scopes**: Same as before (`read_products,write_products`)
5. **Save**

---

## Step 9: Test Installation

After creating the app and saving settings:

### Option A: Via Partner Dashboard
1. In your app page, click **Test on development store**
2. Select your development store
3. Click **Install**

### Option B: Direct URL
Navigate to:
```
https://adventure.app/api/shopify/auth?shop=YOUR-STORE.myshopify.com
```

---

## Important Notes

- ✅ **Don't run `npm init @shopify/app@latest`** - Your code is already set up
- ✅ You're just configuring in Partner Dashboard web interface
- ✅ All the code/integration is already in your project
- ✅ You just need Client ID and Secret from Partner Dashboard

---

## What to Do After App is Created

1. Copy Client ID and Secret to `.env.local`
2. Restart dev server
3. Test OAuth flow
4. Follow the testing guide: `QUICK_START_TEST.md`

---

## Troubleshooting

### "App URL mismatch"
- Make sure App URL in Partner Dashboard matches your actual route
- Verify `/shopify/app` page exists in your app

### "Redirect URL mismatch"
- Check Redirect URLs match exactly (including `http://` vs `https://`)
- No trailing slashes
- Comma-separated, no spaces

### Can't find "Client credentials"
- Make sure you're in **App Setup** section
- Scroll down if needed
- Refresh the page
