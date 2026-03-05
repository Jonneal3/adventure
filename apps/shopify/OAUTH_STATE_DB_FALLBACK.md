# OAuth State Database Fallback

## Problem
Cookies weren't reliably persisting through the OAuth redirect chain (our app → Shopify → back to our app), causing "Invalid OAuth state" errors.

## Solution
Implemented a **dual-verification system**:
1. **Primary**: Cookie-based state verification (fast, standard)
2. **Fallback**: Database-backed state verification (reliable, works when cookies fail)

## Implementation

### 1. Database Table
Created `oauth_states` table in Supabase:
- `state` (text, primary key) - The OAuth state value
- `shop` (text) - The shop domain
- `created_at` (timestamptz) - When the state was created
- `expires_at` (timestamptz) - When the state expires (10 minutes)

### 2. State Storage (`/api/auth`)
When initiating OAuth:
- Generates random state
- Stores in database with 10-minute expiration
- Also sets cookie (primary method)
- Both methods store the same state value

### 3. State Verification (`/api/auth/callback`)
When verifying OAuth callback:
1. **First**: Check cookie (fast, preferred)
2. **If cookie fails**: Check database (reliable fallback)
3. **If either matches**: State is valid ✅
4. **After verification**: Delete state from database (one-time use)

## Benefits

✅ **Reliability** - Works even when cookies are blocked  
✅ **Performance** - Cookie check is fast (primary path)  
✅ **Security** - States expire after 10 minutes  
✅ **One-time use** - States are deleted after verification  
✅ **Automatic cleanup** - Expired states can be cleaned up periodically  

## Database Migration

Run this SQL in Supabase SQL Editor:

```sql
-- oauth_states: temporary storage for OAuth state verification
create table if not exists public.oauth_states (
  state text not null,
  shop text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint oauth_states_pkey primary key (state)
);

create index if not exists idx_oauth_states_shop on public.oauth_states using btree (shop);
create index if not exists idx_oauth_states_expires_at on public.oauth_states using btree (expires_at);
```

## Cleanup

Expired states are automatically filtered out during verification (using `expires_at` check). For manual cleanup:

```sql
DELETE FROM oauth_states WHERE expires_at < NOW();
```

You can set up a cron job to run this periodically, or it's optional since expired states are ignored during verification.

## Testing

After deploying and running the migration:
1. Uninstall app from test store
2. Install app from Shopify App Store
3. Should redirect to OAuth immediately
4. After approving, should complete successfully
5. Check Vercel logs for `state_verified_from_cookie` or `state_verified_from_database`

## Notes

- Database fallback ensures OAuth works even in strict cookie environments
- Cookie is still preferred (faster, no database query)
- States expire after 10 minutes (OAuth should complete in seconds)
- States are deleted after successful verification (one-time use)

