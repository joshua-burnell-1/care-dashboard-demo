
create table public.medical_cache (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  context text not null default '',
  sources jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz not null default now(),
  last_error text,
  constraint medical_cache_singleton check (id = 1)
);

alter table public.medical_cache enable row level security;

-- Public read: the app's password gate is the access control.
create policy "anyone can read medical cache"
  on public.medical_cache for select
  using (true);

-- Writes are blocked at the RLS layer; the edge function uses the
-- service role key, which bypasses RLS.

insert into public.medical_cache (id) values (1);
