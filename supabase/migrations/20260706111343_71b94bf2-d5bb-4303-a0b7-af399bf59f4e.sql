
DROP TABLE IF EXISTS public.appointments CASCADE;

CREATE TYPE public.app_role AS ENUM ('admin', 'therapist', 'patient');

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- THERAPISTS
CREATE TABLE public.therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'permanent' CHECK (status IN ('permanent','non-permanent')),
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'teal',
  work_start INT NOT NULL DEFAULT 510,
  work_end INT NOT NULL DEFAULT 1290,
  work_days INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;

-- PATIENTS
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  slot_key TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_no_double_book UNIQUE (therapist_id, date, slot_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appointments_therapist_date ON public.appointments (therapist_id, date);
CREATE INDEX idx_appointments_patient_date ON public.appointments (patient_id, date);
CREATE INDEX idx_appointments_date_slot ON public.appointments (date, slot_key);

-- POLICIES: user_roles
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- POLICIES: therapists
CREATE POLICY "Authenticated view therapists" ON public.therapists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage therapists" ON public.therapists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Therapist updates own profile" ON public.therapists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- POLICIES: patients
CREATE POLICY "Admins manage patients" ON public.patients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Patient reads own record" ON public.patients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Patient updates own record" ON public.patients FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Patient inserts own record" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Therapist reads patients they treat" ON public.patients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.therapists t ON t.id = a.therapist_id
    WHERE a.patient_id = patients.id AND t.user_id = auth.uid()
  ));

-- POLICIES: appointments (SELECT)
CREATE POLICY "Admins view all appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Therapist views own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Patient views own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid()));

-- POLICIES: appointments (INSERT)
CREATE POLICY "Admins insert appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Therapist inserts own column" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Patient books for self" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- POLICIES: appointments (UPDATE)
CREATE POLICY "Admins update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Therapist updates own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Patient updates own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- POLICIES: appointments (DELETE)
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Therapist deletes own appointments" ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()));
CREATE POLICY "Patient deletes own appointments" ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = appointments.patient_id AND p.user_id = auth.uid()));

-- TRIGGERS
CREATE TRIGGER trg_therapists_updated BEFORE UPDATE ON public.therapists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SIGNUP HANDLER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;
  INSERT INTO public.patients (user_id, name, phone) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  ) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.therapists REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.therapists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;

-- SEED
INSERT INTO public.therapists (name, specialty, status, initials, color, work_start, work_end, work_days, sort_order) VALUES
  ('Dr. Ayesha Rahman', 'Sports & Orthopedic', 'permanent', 'AR', 'teal', 510, 1290, '{0,1,2,3,4,5,6}', 1),
  ('Dr. Marcus Chen', 'Neurological Rehab', 'permanent', 'MC', 'sky', 510, 1290, '{0,1,2,3,4,5,6}', 2),
  ('Dr. Priya Nair', 'Pediatric Physio', 'non-permanent', 'PN', 'indigo', 540, 810, '{1,2,3,4,5}', 3),
  ('Dr. Samuel Okafor', 'Geriatric Care', 'non-permanent', 'SO', 'cyan', 900, 1290, '{1,3,5}', 4);

WITH seed_patients AS (
  INSERT INTO public.patients (name, phone) VALUES
    ('Elena Vasquez', '+1 555-0142'),
    ('James O''Brien', '+1 555-0189'),
    ('Hana Ito', '+1 555-0221'),
    ('Robert Klein', '+1 555-0304'),
    ('Chloé Bernard', '+1 555-0177')
  RETURNING id, name
)
INSERT INTO public.appointments (patient_id, therapist_id, date, slot_key, reason)
SELECT sp.id, t.id, CURRENT_DATE, x.slot_key, x.reason
FROM (VALUES
  ('Elena Vasquez',  'Dr. Ayesha Rahman', '09:15', 'Lower back pain assessment'),
  ('James O''Brien', 'Dr. Marcus Chen',   '10:45', 'Post-ACL recovery, week 3'),
  ('Hana Ito',       'Dr. Priya Nair',    '11:30', 'Pediatric gait training'),
  ('Robert Klein',   'Dr. Samuel Okafor', '16:30', 'Balance & fall prevention'),
  ('Chloé Bernard',  'Dr. Ayesha Rahman', '14:15', 'Shoulder mobility follow-up')
) AS x(patient_name, therapist_name, slot_key, reason)
JOIN seed_patients sp ON sp.name = x.patient_name
JOIN public.therapists t ON t.name = x.therapist_name;
