-- Phase 3: Edit history + rollback
CREATE TABLE public.edit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read edit_history" ON public.edit_history FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.log_edit_history() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.edit_history (table_name, record_id, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.edit_history (table_name, record_id, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.edit_history (table_name, record_id, operation, old_data, new_data)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- dashboard_sections uses TEXT primary key, needs separate function
CREATE OR REPLACE FUNCTION public.log_edit_history_sections() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.edit_history (table_name, record_id, operation, old_data, new_data)
  VALUES ('dashboard_sections', NEW.key, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER log_psa_readings_history
  AFTER INSERT OR UPDATE OR DELETE ON public.psa_readings
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history();

CREATE TRIGGER log_care_team_members_history
  AFTER INSERT OR UPDATE OR DELETE ON public.care_team_members
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history();

CREATE TRIGGER log_medication_items_history
  AFTER INSERT OR UPDATE OR DELETE ON public.medication_items
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history();

CREATE TRIGGER log_kpi_cards_history
  AFTER INSERT OR UPDATE OR DELETE ON public.kpi_cards
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history();

CREATE TRIGGER log_plan_items_history
  AFTER INSERT OR UPDATE OR DELETE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history();

CREATE TRIGGER log_dashboard_sections_history
  AFTER UPDATE ON public.dashboard_sections
  FOR EACH ROW EXECUTE FUNCTION public.log_edit_history_sections();
