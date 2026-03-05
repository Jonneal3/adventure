-- Enable real-time for user_subscriptions table
ALTER PUBLICATION supabase_realtime ADD TABLE user_subscriptions;

-- Enable real-time for related tables that might affect subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE user_accounts; 