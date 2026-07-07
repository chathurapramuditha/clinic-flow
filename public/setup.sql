-- PhysioSchedule: complete Supabase setup (schema + policies + seed + admin RPCs)
-- Run this WHOLE file in: https://supabase.com/dashboard/project/gqfiumavcxiuonwgjxyj/sql/new
-- Expected final output: 9 rows of emails.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'therapist', 'patient');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.therapists (
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
  emp_number TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.patients (
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

CREATE TABLE IF NOT EXISTS public.appointments (
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
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date ON public.appointments (therapist_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON public.appointments (patient_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_slot ON public.appointments (date, slot_key);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_therapists_updated ON public.therapists;
CREATE TRIGGER trg_therapists_updated BEFORE UPDATE ON public.therapists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_patients_updated ON public.patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_appointments_updated ON public.appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated view therapists" ON public.therapists;
CREATE POLICY "Authenticated view therapists" ON public.therapists FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage therapists" ON public.therapists;
CREATE POLICY "Admins manage therapists" ON public.therapists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist updates own profile" ON public.therapists;
CREATE POLICY "Therapist updates own profile" ON public.therapists FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage patients" ON public.patients;
CREATE POLICY "Admins manage patients" ON public.patients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist inserts walk-in patients" ON public.patients;
CREATE POLICY "Therapist inserts walk-in patients" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'therapist'));
DROP POLICY IF EXISTS "Therapist reads patients they treat" ON public.patients;
CREATE POLICY "Therapist reads patients they treat" ON public.patients FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.therapists t ON t.id = a.therapist_id
    WHERE a.patient_id = patients.id AND t.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins view all appointments" ON public.appointments;
CREATE POLICY "Admins view all appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist views own appointments" ON public.appointments;
CREATE POLICY "Therapist views own appointments" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins insert appointments" ON public.appointments;
CREATE POLICY "Admins insert appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist inserts own column" ON public.appointments;
CREATE POLICY "Therapist inserts own column" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins update appointments" ON public.appointments;
CREATE POLICY "Admins update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist updates own appointments" ON public.appointments;
CREATE POLICY "Therapist updates own appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins delete appointments" ON public.appointments;
CREATE POLICY "Admins delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Therapist deletes own appointments" ON public.appointments;
CREATE POLICY "Therapist deletes own appointments" ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()));

ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER TABLE public.therapists REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.therapists;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public._seed_staff_user(_emp text, _password text, _name text, _role app_role)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _email text;
BEGIN
  _email := lower(_emp) || '@staff.local';
  SELECT id INTO _uid FROM auth.users WHERE email = _email;
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    VALUES (_uid, '00000000-0000-0000-0000-000000000000', _email,
            extensions.crypt(_password, extensions.gen_salt('bf')), now(),
            jsonb_build_object('name', _name, 'emp_number', _emp),
            jsonb_build_object('provider','email','providers', ARRAY['email']),
            'authenticated','authenticated', now(), now(),
            '', '', '', '', '', '', '', '');
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid,
            jsonb_build_object('sub', _uid::text, 'email', _email),
            'email', _uid::text, now(), now(), now());
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  RETURN _uid;
END; $$;

DO $$
DECLARE _uid uuid;
BEGIN
  PERFORM public._seed_staff_user('26754', 'Hemas@123', 'Administrator', 'admin');

  _uid := public._seed_staff_user('19352', 'Hemas@123', 'Ms Madhuwanthi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Madhuwanthi', '19352', 'MM', 'teal', 1) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('27527', 'Hemas@123', 'Ms Binudi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Binudi', '27527', 'MB', 'sky', 2) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('28262', 'Hemas@123', 'Ms Bawani', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Bawani', '28262', 'MB', 'indigo', 3) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2562', 'Hemas@123', 'Ms Prashanji', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Prashanji', 'L2562', 'MP', 'cyan', 4) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2386', 'Hemas@123', 'Ms Sandini', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Sandini', 'L2386', 'MS', 'teal', 5) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('23824', 'Hemas@123', 'Ms Lakshi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Lakshi', '23824', 'ML', 'sky', 6) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2497', 'Hemas@123', 'Ms Methni', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Methni', 'L2497', 'MM', 'indigo', 7) ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2020', 'Hemas@123', 'Ms Manthi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color, sort_order)
  VALUES (_uid, 'Ms Manthi', 'L2020', 'MM', 'cyan', 8) ON CONFLICT (emp_number) DO NOTHING;
END $$;

DROP FUNCTION public._seed_staff_user(text, text, text, app_role);

CREATE OR REPLACE FUNCTION public.admin_create_staff(_emp text, _password text, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _email text; _initials text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _emp IS NULL OR length(trim(_emp)) = 0 THEN RAISE EXCEPTION 'Employee number required'; END IF;
  IF _password IS NULL OR length(_password) < 6 THEN RAISE EXCEPTION 'Password must be at least 6 characters'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  _email := lower(trim(_emp)) || '@staff.local';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _email) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;

  _uid := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  VALUES (_uid, '00000000-0000-0000-0000-000000000000', _email,
          extensions.crypt(_password, extensions.gen_salt('bf')), now(),
          jsonb_build_object('name', _name, 'emp_number', _emp),
          jsonb_build_object('provider','email','providers', ARRAY['email']),
          'authenticated','authenticated', now(), now(),
          '', '', '', '', '', '', '', '');
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), _uid,
          jsonb_build_object('sub', _uid::text, 'email', _email),
          'email', _uid::text, now(), now(), now());

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'therapist');

  _initials := upper(substring(regexp_replace(_name, '[^A-Za-z ]','','g'), 1, 2));
  INSERT INTO public.therapists (user_id, name, emp_number, initials)
  VALUES (_uid, _name, _emp, _initials);

  RETURN _uid;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_staff(_target_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _target_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot delete yourself'; END IF;
  DELETE FROM public.therapists WHERE user_id = _target_user_id;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  DELETE FROM auth.identities WHERE user_id = _target_user_id;
  DELETE FROM auth.users WHERE id = _target_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_staff()
RETURNS TABLE(user_id uuid, emp_number text, name text, roles app_role[], created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT u.id,
         COALESCE(t.emp_number, split_part(u.email::text,'@',1)) AS emp_number,
         COALESCE(t.name, u.raw_user_meta_data->>'name', u.email::text) AS name,
         COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]),
         u.created_at
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.therapists t ON t.user_id = u.id
  WHERE u.email LIKE '%@staff.local'
  GROUP BY u.id, u.email, u.created_at, t.emp_number, t.name
  ORDER BY u.created_at DESC;
END; $$;

REVOKE ALL ON FUNCTION public.admin_create_staff(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_staff(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_staff() TO authenticated;

SELECT email FROM auth.users WHERE email LIKE '%@staff.local' ORDER BY email;
