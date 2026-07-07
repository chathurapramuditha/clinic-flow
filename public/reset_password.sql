-- Adds admin_set_password: admin resets a staff member's password.
-- Also signs that member out everywhere (revokes sessions + refresh tokens).
-- Run this WHOLE file in: https://supabase.com/dashboard/project/gqfiumavcxiuonwgjxyj/sql/new

CREATE OR REPLACE FUNCTION public.admin_set_password(_target_user_id uuid, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
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

SELECT 'admin_set_password installed' AS status;
