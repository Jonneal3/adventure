-- Confirmed Adventure V7 Review preferences (and future project signals).
create table if not exists public.adventure_preference_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null,
  session_id text,
  service_id text,
  scopes text[] not null default '{}',
  budget numeric,
  preferences jsonb not null default '{}'::jsonb,
  project jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_adventure_preference_events_instance
  on public.adventure_preference_events (instance_id, created_at desc);

comment on table public.adventure_preference_events is
  'Customer-confirmed taste/preferences from Adventure Review step (+ optional project snapshot).';
