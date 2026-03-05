# Flow Mode Setup - SQL Migrations for Supabase

## Overview
Run these 3 SQL migrations in your Supabase dashboard (SQL Editor) to enable flow mode functionality.

---

## Migration 1: Add flow_config to instances table

**Run this SQL in Supabase SQL Editor:**

```sql
-- Add flow_config column to instances table for form mode configuration

BEGIN;

-- Add flow_config JSON column (nullable)
ALTER TABLE instances
ADD COLUMN IF NOT EXISTS flow_config JSONB;

-- Add comment to document the column
COMMENT ON COLUMN instances.flow_config IS 'Configuration for flow-based form mode. Separate from config (widget mode).';

COMMIT;
```

**What it does:** Adds `flow_config` JSONB column to store flow mode configuration (separate from `config` which is for widget mode).

---

## Migration 2: Add flow columns to form_submissions table

**Run this SQL in Supabase SQL Editor:**

```sql
-- Add flow mode columns to existing form_submissions table

BEGIN;

-- Add submission_type to distinguish between lead_capture and flow submissions
ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'lead_capture' CHECK (submission_type IN ('lead_capture', 'flow'));

-- Add flow-specific columns (nullable, only used for flow submissions)
ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS current_step INTEGER;

ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS generated_designs JSONB;

ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories_subcategories(id) ON DELETE SET NULL;

ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('in_progress', 'completed', 'abandoned'));

ALTER TABLE form_submissions
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add indexes for flow queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_submission_type ON form_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status) WHERE submission_type = 'flow';
CREATE INDEX IF NOT EXISTS idx_form_submissions_category_id ON form_submissions(category_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_subcategory_id ON form_submissions(subcategory_id);

-- Add comments
COMMENT ON COLUMN form_submissions.submission_type IS 'Type of submission: lead_capture (default) or flow';
COMMENT ON COLUMN form_submissions.current_step IS 'Current step in flow (only for flow submissions)';
COMMENT ON COLUMN form_submissions.generated_designs IS 'Generated designs during flow (only for flow submissions)';
COMMENT ON COLUMN form_submissions.status IS 'Flow status: in_progress, completed, or abandoned (only for flow submissions)';

COMMIT;
```

**What it does:** Adds flow-specific columns to the existing `form_submissions` table. Uses `submission_type` to distinguish between lead capture forms and flow forms (no redundant table).

---

## (Deprecated) Migration 3: question_templates

We **no longer store** flow question templates on `categories_subcategories`.

If you previously ran a migration that added `question_templates`, remove it with:
- `supabase/migrations/20260127000005_drop_question_templates.sql`

---

## How to Run in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste **Migration 1** SQL, then click **Run**
6. Repeat for **Migration 2** (run them in order)

---

## What Gets Added

### instances table
- `flow_config` (JSONB) - Stores flow mode configuration

### form_submissions table  
- `submission_type` (TEXT) - 'lead_capture' or 'flow'
- `current_step` (INTEGER) - Current step in flow
- `generated_designs` (JSONB) - Generated designs during flow
- `category_id` (UUID) - Category reference
- `subcategory_id` (UUID) - Subcategory reference  
- `status` (TEXT) - 'in_progress', 'completed', or 'abandoned'
- `completed_at` (TIMESTAMPTZ) - When flow was completed

### categories_subcategories table
- (no flow question template column)

---

## After Running Migrations

Once all 2 migrations are complete:

1. ✅ The `flow_config` column will be available on instances
2. ✅ You can toggle to "Form Mode" in the designer
3. ✅ FlowTab will appear when in Form Mode
4. ✅ Flow submissions will be stored in `form_submissions` with `submission_type='flow'`
5. ✅ (No question templates stored per category/subcategory)

---

## File Locations

The migration files are located at:
- `supabase/migrations/20250131000001_add_flow_config_to_instances.sql`
- `supabase/migrations/20250131000002_add_flow_columns_to_form_submissions.sql`
