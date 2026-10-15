-- ============================================================
-- Family uploads: generic lab_results table + realtime hygiene
-- ============================================================
-- Adds a table for lab values extracted from uploaded documents so
-- they show up in the "All lab values" search + trend charts.
-- Also adds a public.realtime_status view so the ingest-document
-- health-check can verify that documents and lab_results are wired
-- into the supabase_realtime publication.

-- ── lab_results table ──────────────────────────────────────────
CREATE TABLE public.lab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  metric TEXT NOT NULL,
  category TEXT,
  value_numeric NUMERIC,
  value_text TEXT,
  unit TEXT NOT NULL DEFAULT '',
  reference_range TEXT,
  flag TEXT CHECK (flag IS NULL OR flag IN ('HIGH', 'LOW', 'NORMAL', 'ABNORMAL')),
  source TEXT NOT NULL DEFAULT 'upload',
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lab_results_metric_date_idx ON public.lab_results (metric, date DESC);
CREATE INDEX lab_results_source_document_id_idx ON public.lab_results (source_document_id);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read lab_results" ON public.lab_results
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE TRIGGER update_lab_results_updated_at
  BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Realtime publication (idempotent) ──────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_results;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.lab_results REPLICA IDENTITY FULL;

-- ── realtime_status view for health-check ──────────────────────
CREATE OR REPLACE VIEW public.realtime_status AS
SELECT tablename AS table_name, TRUE AS enabled
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public';

GRANT SELECT ON public.realtime_status TO service_role;
GRANT SELECT ON public.realtime_status TO authenticated;
