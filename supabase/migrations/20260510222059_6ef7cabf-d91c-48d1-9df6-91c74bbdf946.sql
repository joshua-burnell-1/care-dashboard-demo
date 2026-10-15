alter publication supabase_realtime add table public.medical_cache;
alter table public.medical_cache replica identity full;