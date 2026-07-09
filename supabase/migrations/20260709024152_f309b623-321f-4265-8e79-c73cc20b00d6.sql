CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'therapist')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Therapist reads patients they treat" ON public.patients;
DROP POLICY IF EXISTS "Therapist inserts walk-in patients" ON public.patients;
DROP POLICY IF EXISTS "Staff view patients" ON public.patients;
DROP POLICY IF EXISTS "Staff insert patients" ON public.patients;
DROP POLICY IF EXISTS "Staff update patients" ON public.patients;

CREATE POLICY "Staff view patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update patients"
ON public.patients
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Therapist views own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Therapist inserts own column" ON public.appointments;
DROP POLICY IF EXISTS "Therapist updates own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Therapist deletes own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Staff delete appointments" ON public.appointments;

CREATE POLICY "Staff view appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff insert appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff update appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff delete appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.is_staff(auth.uid()));