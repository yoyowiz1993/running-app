-- Add Garmin OAuth token columns to user_state for token persistence.
-- Run in Supabase SQL Editor. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend.

ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS garmin_access_token text,
  ADD COLUMN IF NOT EXISTS garmin_refresh_token text,
  ADD COLUMN IF NOT EXISTS garmin_expires_at bigint;
