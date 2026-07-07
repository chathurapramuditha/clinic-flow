-- Adds admin_update_staff: edit a staff member's name, employee number,
-- roles (admin/therapist) and staff type (permanent/part-time).
-- Run this WHOLE file in: https://supabase.com/dashboard/project/gqfiumavcxiuonwgjxyj/sql/new

DROP FUNCTION IF EXISTS public.admin_update_staff(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_staff(
  _target_user_id uuid,
  _emp text,
  _name text,
  _is_admin boolean,
  _is_therapist boolean,
  _status text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _old_email text; _initials text; _had_admin boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _emp IS NULL OR length(trim(_emp)) = 0 THEN RAISE EXCEPTION 'Employee number required'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;
  IF NOT _is_admin AND NOT _is_therapist THEN RAISE EXCEPTION 'Staff member must have at least one role'; END IF;
  IF _status IS NULL OR _status NOT IN ('permanent','non-permanent') THEN RAISE EXCEPTION 'Invalid staff type'; END IF;

  SELECT email INTO _old_email FROM auth.users WHERE id = _target_user_id;
  IF _old_email IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  _email := lower(trim(_emp)) || '@staff.local';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _email AND id <> _target_user_id) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.therapists WHERE emp_number = trim(_emp) AND (user_id IS NULL OR user_id <> _target_user_id)) THEN
    RAISE EXCEPTION 'Employee number already exists';
  END IF;

  _had_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin');
  IF _had_admin AND NOT _is_admin THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last admin';
    END IF;
  END IF;

  IF NOT _is_therapist AND EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.therapists t ON t.id = a.therapist_id
    WHERE t.user_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove therapist role: this staff member has appointments';
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

  IF _is_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin';
  END IF;

  _initials := upper(substring(regexp_replace(trim(_name), '[^A-Za-z ]', '', 'g'), 1, 2));

  IF _is_therapist THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, 'therapist') ON CONFLICT DO NOTHING;
    IF EXISTS (SELECT 1 FROM public.therapists WHERE user_id = _target_user_id) THEN
      UPDATE public.therapists
      SET name = trim(_name), emp_number = trim(_emp), initials = _initials, status = _status
      WHERE user_id = _target_user_id;
    ELSE
      INSERT INTO public.therapists (user_id, name, emp_number, initials, status)
      VALUES (_target_user_id, trim(_name), trim(_emp), _initials, _status);
    END IF;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user_id AND role = 'therapist';
    DELETE FROM public.therapists WHERE user_id = _target_user_id;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_staff(uuid, text, text, boolean, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_staff(uuid, text, text, boolean, boolean, text) TO authenticated;

SELECT 'admin_update_staff installed' AS status;
