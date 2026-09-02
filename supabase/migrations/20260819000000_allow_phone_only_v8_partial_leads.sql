-- V8 visitors may save an unfinished estimate with only a phone number.
ALTER TABLE public.form_submissions
  ALTER COLUMN email DROP NOT NULL;
