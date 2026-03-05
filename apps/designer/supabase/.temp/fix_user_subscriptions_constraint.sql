-- Fix user_subscriptions table to prevent duplicate subscriptions
-- Add unique constraint on user_id to ensure only one subscription per user

-- First, let's clean up any existing duplicate subscriptions
-- Keep the most recent one for each user
DELETE FROM user_subscriptions 
WHERE id NOT IN (
  SELECT MAX(id) 
  FROM user_subscriptions 
  GROUP BY user_id
);

-- Add unique constraint on user_id
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_user_id_unique 
UNIQUE (user_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id 
ON user_subscriptions (user_id);

-- Add check constraint to ensure status is valid
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_status_check 
CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'unpaid'));

-- Add not null constraints for important fields
ALTER TABLE user_subscriptions 
ALTER COLUMN user_id SET NOT NULL,
ALTER COLUMN plan_id SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN created_at SET NOT NULL;

-- Add comment to document the constraint
COMMENT ON CONSTRAINT user_subscriptions_user_id_unique ON user_subscriptions 
IS 'Ensures only one subscription per user to prevent duplicates'; 