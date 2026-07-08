CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.is_patient_record_owner(_patient_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = _patient_id
      AND p.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_patient_record_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_patient_record_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patient_record_owner(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_therapist_record_owner(_therapist_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.id = _therapist_id
      AND t.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_therapist_record_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_therapist_record_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_therapist_record_owner(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_patient_treated_by_staff(_patient_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.therapists t ON t.id = a.therapist_id
    WHERE a.patient_id = _patient_id
      AND t.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_patient_treated_by_staff(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_patient_treated_by_staff(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patient_treated_by_staff(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Patient books for self" ON public.appointments;
CREATE POLICY "Patient books for self"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.is_patient_record_owner(patient_id, auth.uid()));

DROP POLICY IF EXISTS "Patient deletes own appointments" ON public.appointments;
CREATE POLICY "Patient deletes own appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.is_patient_record_owner(patient_id, auth.uid()));

DROP POLICY IF EXISTS "Patient updates own appointments" ON public.appointments;
CREATE POLICY "Patient updates own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (public.is_patient_record_owner(patient_id, auth.uid()))
WITH CHECK (public.is_patient_record_owner(patient_id, auth.uid()));

DROP POLICY IF EXISTS "Patient views own appointments" ON public.appointments;
CREATE POLICY "Patient views own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.is_patient_record_owner(patient_id, auth.uid()));

DROP POLICY IF EXISTS "Therapist deletes own appointments" ON public.appointments;
CREATE POLICY "Therapist deletes own appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.is_therapist_record_owner(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapist inserts own column" ON public.appointments;
CREATE POLICY "Therapist inserts own column"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.is_therapist_record_owner(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapist updates own appointments" ON public.appointments;
CREATE POLICY "Therapist updates own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (public.is_therapist_record_owner(therapist_id, auth.uid()))
WITH CHECK (public.is_therapist_record_owner(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapist views own appointments" ON public.appointments;
CREATE POLICY "Therapist views own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.is_therapist_record_owner(therapist_id, auth.uid()));

DROP POLICY IF EXISTS "Therapist reads patients they treat" ON public.patients;
CREATE POLICY "Therapist reads patients they treat"
ON public.patients
FOR SELECT
TO authenticated
USING (public.is_patient_treated_by_staff(id, auth.uid()));