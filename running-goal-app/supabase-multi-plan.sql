-- Run this in Supabase SQL editor to enable multiple plans + active plan selection.

alter table public.user_state
  add column if not exists plans jsonb,
  add column if not exists active_plan_id text;
