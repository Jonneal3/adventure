-- Test what happens when we try to truncate
-- This will show the exact error message

BEGIN;
TRUNCATE categories_subcategories CASCADE;
ROLLBACK;
