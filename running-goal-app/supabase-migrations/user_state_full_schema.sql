-- Consolidated migration: add all user_state columns for plans, onboarding, and nutrition.
-- Run this in Supabase SQL Editor if plans aren't syncing or you get "column not found" errors.
-- This adds columns that may already exist; IF NOT EXISTS makes it safe to run multiple times.

-- Multi-plan support (plans array + active plan selection)
ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS plans jsonb,
  ADD COLUMN IF NOT EXISTS active_plan_id text;

-- Onboarding flow persistence
ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Nutrition goals (synced with plan data)
ALTER TABLE public.user_state
  ADD COLUMN IF NOT EXISTS nutrition_goals jsonb;
