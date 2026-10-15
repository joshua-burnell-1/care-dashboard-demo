-- Require authentication for all table reads.
-- The single shared user (demo@example.com) is authenticated via
-- supabase.auth.signInWithPassword in PasswordGate.tsx. Every SELECT now checks
-- auth.role() = 'authenticated' so the anon key alone cannot read any data.

-- medical_cache
DROP POLICY IF EXISTS "anyone can read medical cache" ON public.medical_cache;
CREATE POLICY "auth read medical_cache" ON public.medical_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- plan_items
DROP POLICY IF EXISTS "anyone can read plan items" ON public.plan_items;
CREATE POLICY "auth read plan_items" ON public.plan_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- psa_readings
DROP POLICY IF EXISTS "public read psa_readings" ON public.psa_readings;
CREATE POLICY "auth read psa_readings" ON public.psa_readings
  FOR SELECT USING (auth.role() = 'authenticated');

-- care_team_members
DROP POLICY IF EXISTS "public read care_team_members" ON public.care_team_members;
CREATE POLICY "auth read care_team_members" ON public.care_team_members
  FOR SELECT USING (auth.role() = 'authenticated');

-- medication_items
DROP POLICY IF EXISTS "public read medication_items" ON public.medication_items;
CREATE POLICY "auth read medication_items" ON public.medication_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- kpi_cards
DROP POLICY IF EXISTS "public read kpi_cards" ON public.kpi_cards;
CREATE POLICY "auth read kpi_cards" ON public.kpi_cards
  FOR SELECT USING (auth.role() = 'authenticated');

-- dashboard_sections
DROP POLICY IF EXISTS "public read dashboard_sections" ON public.dashboard_sections;
CREATE POLICY "auth read dashboard_sections" ON public.dashboard_sections
  FOR SELECT USING (auth.role() = 'authenticated');

-- documents
DROP POLICY IF EXISTS "public read documents" ON public.documents;
CREATE POLICY "auth read documents" ON public.documents
  FOR SELECT USING (auth.role() = 'authenticated');

-- chat_sessions
DROP POLICY IF EXISTS "public read chat_sessions" ON public.chat_sessions;
CREATE POLICY "auth read chat_sessions" ON public.chat_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

-- chat_messages
DROP POLICY IF EXISTS "public read chat_messages" ON public.chat_messages;
CREATE POLICY "auth read chat_messages" ON public.chat_messages
  FOR SELECT USING (auth.role() = 'authenticated');

-- edit_history
DROP POLICY IF EXISTS "public read edit_history" ON public.edit_history;
CREATE POLICY "auth read edit_history" ON public.edit_history
  FOR SELECT USING (auth.role() = 'authenticated');
