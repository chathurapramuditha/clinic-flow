
CREATE OR REPLACE FUNCTION public.admin_set_password(_target_user_id uuid, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _password IS NULL OR length(_password) < 6 THEN RAISE EXCEPTION 'Password must be at least 6 characters'; END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  DELETE FROM auth.sessions WHERE user_id = _target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = _target_user_id::text;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_password(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_staff(
  _target_user_id uuid,
  _emp text,
  _name text,
  _is_admin boolean,
  _is_therapist boolean,
  _status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _initials text; _current_admin_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _emp IS NULL OR length(trim(_emp)) = 0 THEN RAISE EXCEPTION 'Employee number required'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF NOT _is_admin AND NOT _is_therapist THEN RAISE EXCEPTION 'Select at least one role'; END IF;
  IF _status NOT IN ('permanent','non-permanent') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  _email := lower(trim(_emp)) || '@staff.local';

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _email AND id <> _target_user_id) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;

  UPDATE auth.users
  SET email = _email,
      raw_user_meta_data = COALESCE(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('name', _name, 'emp_number', _emp),
      updated_at = now()
  WHERE id = _target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  UPDATE auth.identities
  SET identity_data = COALESCE(identity_data,'{}'::jsonb) || jsonb_build_object('email', _email),
      updated_at = now()
  WHERE user_id = _target_user_id AND provider = 'email';

  -- Admin role
  IF _is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    IF _target_user_id = auth.uid() THEN
      SELECT COUNT(*) INTO _current_admin_count FROM public.user_roles WHERE role='admin';
      IF _current_admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove the last admin'; END IF;
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin';
  END IF;

  -- Therapist role + row
  IF _is_therapist THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, 'therapist')
    ON CONFLICT (user_id, role) DO NOTHING;
    _initials := upper(substring(regexp_replace(_name, '[^A-Za-z ]','','g'), 1, 2));
    IF EXISTS (SELECT 1 FROM public.therapists WHERE user_id = _target_user_id) THEN
      UPDATE public.therapists
      SET name = _name, emp_number = _emp, initials = _initials, status = _status
      WHERE user_id = _target_user_id;
    ELSE
      INSERT INTO public.therapists (user_id, name, emp_number, initials, status)
      VALUES (_target_user_id, _name, _emp, _initials, _status);
    END IF;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = 'therapist';
    DELETE FROM public.therapists WHERE user_id = _target_user_id;
  END IF;

  -- Patient role fallback if neither admin nor therapist? already guarded above.
  -- Also keep 'patient' role removed for staff accounts
  DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = 'patient';
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_staff(uuid, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_staff(uuid, text, text, boolean, boolean, text) TO authenticated;
