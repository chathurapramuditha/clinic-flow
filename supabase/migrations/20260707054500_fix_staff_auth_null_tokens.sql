-- Repair staff users created by raw inserts into auth.users (NULL token columns
-- crash GoTrue with "Database error querying schema") and fix admin_create_staff
-- to set those columns going forward.

UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE email LIKE '%@staff.local';

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
