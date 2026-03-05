-- Clean up user_subscriptions table
-- Run this in your Supabase SQL Editor

BEGIN;

-- First, let's see what we're working with
DO $$
BEGIN
    RAISE NOTICE 'Current user_subscriptions count: %', (SELECT COUNT(*) FROM user_subscriptions);
    RAISE NOTICE 'Users with multiple subscriptions: %', (
        SELECT COUNT(*) FROM (
            SELECT user_id, COUNT(*) as count 
            FROM user_subscriptions 
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        ) as duplicates
    );
END $$;

-- Clean up duplicate subscriptions - keep the most recent one for each user
DELETE FROM user_subscriptions 
WHERE subscription_id NOT IN (
    SELECT DISTINCT ON (user_id) subscription_id
    FROM user_subscriptions
    ORDER BY user_id, created_at DESC
);

-- Ensure unique constraint on user_id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'user_subscriptions' 
        AND constraint_name = 'user_subscriptions_user_id_unique'
    ) THEN
        ALTER TABLE user_subscriptions 
        ADD CONSTRAINT user_subscriptions_user_id_unique 
        UNIQUE (user_id);
        RAISE NOTICE 'Added unique constraint on user_id';
    ELSE
        RAISE NOTICE 'Unique constraint on user_id already exists';
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status 
ON user_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer_id 
ON user_subscriptions (stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription_id 
ON user_subscriptions (stripe_subscription_id) 
WHERE stripe_subscription_id IS NOT NULL;

-- Ensure all required fields exist with proper types
ALTER TABLE user_subscriptions 
ALTER COLUMN subscription_id SET DEFAULT gen_random_uuid(),
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN plan_id SET NOT NULL,
ALTER COLUMN monthly_price_cents SET NOT NULL,
ALTER COLUMN ai_credits_balance SET NOT NULL DEFAULT 0,
ALTER COLUMN start_date SET NOT NULL,
ALTER COLUMN status SET NOT NULL DEFAULT 'trialing',
ALTER COLUMN created_at SET NOT NULL DEFAULT now(),
ALTER COLUMN updated_at SET NOT NULL DEFAULT now();

-- Ensure stripe fields are nullable (for trial users)
ALTER TABLE user_subscriptions 
ALTER COLUMN stripe_customer_id DROP NOT NULL,
ALTER COLUMN stripe_subscription_id DROP NOT NULL,
ALTER COLUMN end_date DROP NOT NULL;

-- Add any missing fields that might be needed
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_purchase_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_purchase_amount INTEGER DEFAULT NULL;

-- Update any NULL values with proper defaults
UPDATE user_subscriptions 
SET 
    ai_credits_balance = COALESCE(ai_credits_balance, 0),
    status = COALESCE(status, 'trialing'),
    created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now())
WHERE 
    ai_credits_balance IS NULL 
    OR status IS NULL 
    OR created_at IS NULL 
    OR updated_at IS NULL;

-- Verify the cleanup
DO $$
BEGIN
    RAISE NOTICE 'After cleanup - user_subscriptions count: %', (SELECT COUNT(*) FROM user_subscriptions);
    RAISE NOTICE 'Users with multiple subscriptions: %', (
        SELECT COUNT(*) FROM (
            SELECT user_id, COUNT(*) as count 
            FROM user_subscriptions 
            GROUP BY user_id 
            HAVING COUNT(*) > 1
        ) as duplicates
    );
END $$;

COMMIT; 