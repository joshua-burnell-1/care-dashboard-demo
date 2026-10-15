
CREATE TABLE public.plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Scheduled',
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read plan items"
  ON public.plan_items
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_plan_items_updated_at
  BEFORE UPDATE ON public.plan_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
