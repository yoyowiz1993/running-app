-- Run this in Supabase SQL editor to enable nutrition / calorie logging.

create table if not exists public.nutrition_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  food_fdc_id text,
  food_name text not null,
  amount numeric not null default 1,
  unit text not null default 'serving',
  calories numeric not null default 0,
  protein numeric,
  carbs numeric,
  fat numeric,
  created_at timestamptz not null default now()
);

alter table public.nutrition_log enable row level security;

create policy "users_select_own_nutrition"
  on public.nutrition_log for select using (auth.uid() = user_id);
create policy "users_insert_own_nutrition"
  on public.nutrition_log for insert with check (auth.uid() = user_id);
create policy "users_update_own_nutrition"
  on public.nutrition_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users_delete_own_nutrition"
  on public.nutrition_log for delete using (auth.uid() = user_id);
