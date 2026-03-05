-- Simple query to find ALL foreign key constraints referencing categories_subcategories
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    a.attname as column_name,
    confrelid::regclass as referenced_table,
    af.attname as referenced_column,
    confdeltype as delete_action
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.contype = 'f' 
AND confrelid::regclass::text = 'categories_subcategories'
ORDER BY table_name;
