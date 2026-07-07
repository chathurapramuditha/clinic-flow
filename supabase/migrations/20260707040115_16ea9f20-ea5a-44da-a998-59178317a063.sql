
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS emp_number text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapists_emp_number_key') THEN
    ALTER TABLE public.therapists ADD CONSTRAINT therapists_emp_number_key UNIQUE (emp_number);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._seed_staff_user(_emp text, _password text, _name text, _role app_role)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _email text;
BEGIN
  _email := lower(_emp) || '@staff.local';
  SELECT id INTO _uid FROM auth.users WHERE email = _email;
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
    VALUES (_uid, '00000000-0000-0000-0000-000000000000', _email,
            extensions.crypt(_password, extensions.gen_salt('bf')), now(),
            jsonb_build_object('name', _name, 'emp_number', _emp),
            jsonb_build_object('provider','email','providers', ARRAY['email']),
            'authenticated','authenticated', now(), now());
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
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Madhuwanthi', '19352', 'MM', 'teal') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('27527', 'Hemas@123', 'Ms Binudi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Binudi', '27527', 'MB', 'sky') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('28262', 'Hemas@123', 'Ms Bawani', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Bawani', '28262', 'MB', 'indigo') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2562', 'Hemas@123', 'Ms Prashanji', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Prashanji', 'L2562', 'MP', 'cyan') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2386', 'Hemas@123', 'Ms Sandini', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Sandini', 'L2386', 'MS', 'teal') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('23824', 'Hemas@123', 'Ms Lakshi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Lakshi', '23824', 'ML', 'sky') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2497', 'Hemas@123', 'Ms Methni', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Methni', 'L2497', 'MM', 'indigo') ON CONFLICT (emp_number) DO NOTHING;

  _uid := public._seed_staff_user('L2020', 'Hemas@123', 'Ms Manthi', 'therapist');
  INSERT INTO public.therapists (user_id, name, emp_number, initials, color)
  VALUES (_uid, 'Ms Manthi', 'L2020', 'MM', 'cyan') ON CONFLICT (emp_number) DO NOTHING;
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
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
  VALUES (_uid, '00000000-0000-0000-0000-000000000000', _email,
          extensions.crypt(_password, extensions.gen_salt('bf')), now(),
          jsonb_build_object('name', _name, 'emp_number', _emp),
          jsonb_build_object('provider','email','providers', ARRAY['email']),
          'authenticated','authenticated', now(), now());
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
