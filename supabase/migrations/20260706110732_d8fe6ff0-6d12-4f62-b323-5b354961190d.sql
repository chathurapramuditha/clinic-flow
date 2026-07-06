
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  therapist_id TEXT NOT NULL,
  date DATE NOT NULL,
  slot_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, date, slot_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "Anyone can create appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update appointments" ON public.appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete appointments" ON public.appointments FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

INSERT INTO public.appointments (patient_name, patient_phone, reason, therapist_id, date, slot_key) VALUES
  ('Elena Vasquez', '+1 555-0142', 'Lower back pain assessment', 't-1', CURRENT_DATE, '09:15'),
  ('James O''Brien', '+1 555-0189', 'Post-ACL recovery, week 3', 't-2', CURRENT_DATE, '10:45'),
  ('Hana Ito', '+1 555-0221', 'Pediatric gait training', 't-3', CURRENT_DATE, '11:30'),
  ('Robert Klein', '+1 555-0304', 'Balance & fall prevention', 't-4', CURRENT_DATE, '16:30'),
  ('Chloé Bernard', '+1 555-0177', 'Shoulder mobility follow-up', 't-1', CURRENT_DATE, '14:15');
