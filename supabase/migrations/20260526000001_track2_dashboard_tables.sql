-- ============================================================
-- Track 2: Configurable Dashboard Tables
-- Demo rows for these tables are loaded from supabase/seed.sql
-- ============================================================

-- PSA readings (replaces psaHistory array)
CREATE TABLE public.psa_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  value NUMERIC,
  unit TEXT NOT NULL DEFAULT 'ng/mL',
  phase TEXT NOT NULL DEFAULT 'post-rad',
  note TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Care team members (replaces careTeam array)
CREATE TABLE public.care_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  where_based TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medications (replaces medications array)
CREATE TABLE public.medication_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item TEXT NOT NULL,
  dose TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  started_by TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KPI cards (replaces kpis array)
CREATE TABLE public.kpi_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sub TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'neutral',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Flexible JSONB blobs for structured content sections
-- keys: summary, patient, agreements, disagreements, red_flags, decision_tree,
--       doctors, nutrition_foods, nutrition_avoid, pathology_features,
--       doubling_bands, glossary
CREATE TABLE public.dashboard_sections (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS: public read; writes go through edge function with service role ──
ALTER TABLE public.psa_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read psa_readings" ON public.psa_readings FOR SELECT USING (true);
CREATE POLICY "public read care_team_members" ON public.care_team_members FOR SELECT USING (true);
CREATE POLICY "public read medication_items" ON public.medication_items FOR SELECT USING (true);
CREATE POLICY "public read kpi_cards" ON public.kpi_cards FOR SELECT USING (true);
CREATE POLICY "public read dashboard_sections" ON public.dashboard_sections FOR SELECT USING (true);

-- ── updated_at triggers (reuses function from plan_items migration) ──
CREATE TRIGGER update_psa_readings_updated_at
  BEFORE UPDATE ON public.psa_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_care_team_members_updated_at
  BEFORE UPDATE ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medication_items_updated_at
  BEFORE UPDATE ON public.medication_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kpi_cards_updated_at
  BEFORE UPDATE ON public.kpi_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
