-- Adds admin_update_staff: edit a staff member's name and employee number.
-- Run this WHOLE file in: https://supabase.com/dashboard/project/gqfiumavcxiuonwgjxyj/sql/new

CREATE OR REPLACE FUNCTION public.admin_update_staff(_target_user_id uuid, _emp text, _name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _old_email text; _initials text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _emp IS NULL OR length(trim(_emp)) = 0 THEN RAISE EXCEPTION 'Employee number required'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  SELECT email INTO _old_email FROM auth.users WHERE id = _target_user_id;
  IF _old_email IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  _email := lower(trim(_emp)) || '@staff.local';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _email AND id <> _target_user_id) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.therapists WHERE emp_number = trim(_emp) AND user_id <> _target_user_id) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;

  UPDATE auth.users SET
    email = _email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('name', trim(_name), 'emp_number', trim(_emp)),
    updated_at = now()
  WHERE id = _target_user_id;

  UPDATE auth.identities SET
    identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', _email),
    updated_at = now()
  WHERE user_id = _target_user_id AND provider = 'email';

  _initials := upper(substring(regexp_replace(trim(_name), '[^A-Za-z ]', '', 'g'), 1, 2));
  UPDATE public.therapists
  SET name = trim(_name), emp_number = trim(_emp), initials = _initials
  WHERE user_id = _target_user_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_staff(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_staff(uuid, text, text) TO authenticated;

SELECT 'admin_update_staff installed' AS status;
