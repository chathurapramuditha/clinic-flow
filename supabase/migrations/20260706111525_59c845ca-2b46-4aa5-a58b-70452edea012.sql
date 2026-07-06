
CREATE POLICY "Therapist inserts walk-in patients"
  ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'therapist'));
