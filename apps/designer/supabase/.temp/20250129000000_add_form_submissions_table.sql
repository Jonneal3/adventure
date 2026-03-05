-- Migration to add form_submissions table for tracking lead form submissions
-- This will replace the localStorage-based tracking with proper database storage

BEGIN;

-- Create form_submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  is_partial BOOLEAN DEFAULT false,
  submission_data JSONB, -- Store additional form data like step, terms_accepted, etc.
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  session_id TEXT, -- To track submissions within the same session
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_instance_id ON form_submissions(instance_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_account_id ON form_submissions(account_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON form_submissions(email);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_session_id ON form_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_instance_email ON form_submissions(instance_id, email);

-- Add trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_form_submissions_updated_at ON form_submissions;
CREATE TRIGGER update_form_submissions_updated_at
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to automatically set account_id from instance
CREATE OR REPLACE FUNCTION set_form_submission_account_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.account_id IS NULL THEN
        SELECT account_id INTO NEW.account_id 
        FROM instances 
        WHERE id = NEW.instance_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_form_submission_account_id_trigger
    BEFORE INSERT ON form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_form_submission_account_id();

-- Add RLS policies for form_submissions
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Policy for users to view submissions for their instances
CREATE POLICY "Users can view form submissions for their instances" ON form_submissions
  FOR SELECT USING (
    account_id IN (
      SELECT account_id FROM user_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for users to insert submissions for their instances
CREATE POLICY "Users can create form submissions for their instances" ON form_submissions
  FOR INSERT WITH CHECK (
    account_id IN (
      SELECT account_id FROM user_accounts 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for public insert (for widget submissions)
CREATE POLICY "Public can create form submissions" ON form_submissions
  FOR INSERT WITH CHECK (true);

-- Function to check if session has completed step 2 (name and phone)
CREATE OR REPLACE FUNCTION has_session_completed_step2(
  p_instance_id UUID,
  p_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  submission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO submission_count
  FROM form_submissions
  WHERE instance_id = p_instance_id 
    AND session_id = p_session_id
    AND name IS NOT NULL 
    AND phone IS NOT NULL
    AND phone != ''  -- Ensure phone is not empty
    AND created_at > NOW() - INTERVAL '24 hours'; -- Only check last 24 hours
  
  RETURN submission_count > 0;
END;
$$;

-- Function to get partial submission count for an instance in a session
CREATE OR REPLACE FUNCTION get_session_partial_submission_count(
  p_instance_id UUID,
  p_session_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  submission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO submission_count
  FROM form_submissions
  WHERE instance_id = p_instance_id 
    AND session_id = p_session_id
    AND is_partial = true  -- Only partial submissions
    AND created_at > NOW() - INTERVAL '1 hour'; -- Session submissions within last hour
  
  RETURN submission_count;
END;
$$;

COMMIT; 