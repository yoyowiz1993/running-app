-- Add onboarding_complete column to user_state for onboarding flow persistence.
-- Run this in Supabase SQL Editor: Dashboard > SQL Editor > New query

ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
