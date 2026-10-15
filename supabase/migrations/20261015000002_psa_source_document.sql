-- ============================================================
-- PSA readings remember the document they came from
-- ============================================================
-- Mirrors lab_results.source_document_id: set when a reading is applied from an uploaded
-- document, so the document page can list what came from it. Deleting the document keeps the
-- reading and clears the link.

ALTER TABLE public.psa_readings ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS psa_readings_source_document_id_idx ON public.psa_readings (source_document_id);
