# Stripe Live Mode Setup Guide

## Overview
This guide will help you switch from Stripe test mode to live mode for production deployment.

## Current Configuration
The app supports both test and live modes through environment variables. The webhook handler now uses `STRIPE_MODE` environment variable to determine which mode to use.

## Environment Variables Required for Live Mode

### Required Environment Variables
```bash
# Stripe Mode (set to "live" for production)
STRIPE_MODE=live

# Live Mode Keys
STRIPE_SECRET_KEY=sk_live_...          # Your live secret key
STRIPE_WEBHOOK_SECRET=whsec_...        # Your live webhook secret

# Test Mode Keys (keep for development)
STRIPE_TEST_SECRET_KEY=sk_test_...     # Your test secret key  
STRIPE_TEST_WEBHOOK_SECRET=whsec_...   # Your test webhook secret

# Publishable Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Live publishable key
NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...  # Test publishable key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_IS_ENABLED=true
```

### Optional Environment Variables
```bash
# App URL for success/cancel redirects
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Steps to Go Live

### 1. Get Your Live Stripe Keys
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Switch to "Live" mode (toggle in top right)
3. Copy your live secret key (`sk_live_...`)
4. Copy your live publishable key (`pk_live_...`)

### 2. Set Up Live Webhook
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL to: `https://your-domain.com/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `invoice.payment_action_required`
   - `payment_intent.succeeded`
5. Copy the webhook secret (`whsec_...`)

### 3. Create Live Products and Prices
1. Go to [Stripe Products](https://dashboard.stripe.com/products)
2. Create products for each plan (Basic, Pro, Enterprise)
3. Set up recurring prices for each plan
4. Note the price IDs for each plan

### 4. Update Environment Variables
Set these environment variables in your production environment (Vercel, etc.):

```bash
STRIPE_MODE=live
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
NEXT_PUBLIC_STRIPE_IS_ENABLED=true
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 5. Test the Setup
1. Deploy with live environment variables
2. Test a small purchase with a real card
3. Verify webhook events are received
4. Check that subscriptions are created in your database

## Frontend Mode Control

### Current Behavior
- Frontend uses localStorage to store mode preference
- Users can toggle between test/live mode in the UI
- This is fine for development but not ideal for production

### Production Recommendation
For production, you should:

1. **Remove the mode toggle from the UI** - users shouldn't be able to switch modes
2. **Use server-side mode detection** - let the server determine the mode based on environment variables
3. **Update the frontend hooks** to use the server-determined mode

### Quick Fix for Production
If you want to go live immediately without major frontend changes:

1. Set `STRIPE_MODE=live` in your environment variables
2. The webhook will automatically use live mode
3. The frontend will still allow mode switching, but you can hide the toggle component

## Security Considerations

### Environment Variables
- Never commit live Stripe keys to version control
- Use environment variables in your deployment platform
- Rotate keys regularly

### Webhook Security
- Always verify webhook signatures
- Use HTTPS endpoints only
- Monitor webhook failures

### Testing
- Test thoroughly in test mode before going live
- Use Stripe's test cards for testing
- Monitor logs for any issues

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Check that you're using the correct webhook secret
   - Ensure the webhook URL is correct
   - Verify the webhook is receiving events

2. **Subscription not created**
   - Check webhook logs
   - Verify database connection
   - Check that the user exists

3. **Payment fails**
   - Check Stripe dashboard for payment errors
   - Verify card details
   - Check for any restrictions on the account

### Debug Mode
To debug issues, you can temporarily set:
```bash
STRIPE_MODE=test  # Switch back to test mode
```

## Rollback Plan
If you need to rollback to test mode:
1. Set `STRIPE_MODE=test` in environment variables
2. Redeploy the application
3. The webhook will automatically switch back to test mode

## Support
If you encounter issues:
1. Check Stripe dashboard for payment status
2. Review application logs
3. Check webhook delivery status in Stripe dashboard
4. Verify environment variables are set correctly 