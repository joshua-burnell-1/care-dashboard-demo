-- Phase 2: File upload + document storage
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'indexed', 'error')),
  error TEXT,
  extracted_chars INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read documents" ON public.documents FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER TABLE public.documents REPLICA IDENTITY FULL;

-- Storage bucket for uploaded medical files
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-documents', 'medical-documents', false);
