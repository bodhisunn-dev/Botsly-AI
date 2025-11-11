-- Cleanup script to remove inactive users from the database
-- This removes users who haven't been active in over 60 days

-- First, let's see how many users will be affected
SELECT 
  COUNT(*) as users_to_delete,
  COUNT(*) FILTER (WHERE last_active_at < NOW() - INTERVAL '60 days') as inactive_60_days,
  COUNT(*) FILTER (WHERE last_active_at < NOW() - INTERVAL '90 days') as inactive_90_days,
  COUNT(*) FILTER (WHERE message_count = 0) as zero_messages
FROM telegram_users;

-- Delete users who haven't been active in over 90 days AND have 0 messages
-- This is a safe cleanup that removes clearly inactive/ghost users
DELETE FROM telegram_users 
WHERE last_active_at < NOW() - INTERVAL '90 days' 
AND message_count = 0;

-- OR use this more aggressive cleanup for users inactive for 60+ days
-- DELETE FROM telegram_users 
-- WHERE last_active_at < NOW() - INTERVAL '60 days';

-- Verify the new count
SELECT COUNT(*) as remaining_users FROM telegram_users;
