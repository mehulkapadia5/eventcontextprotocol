
CREATE POLICY "Admins can insert annotations"
  ON public.event_annotations FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update annotations"
  ON public.event_annotations FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete annotations"
  ON public.event_annotations FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all annotations"
  ON public.event_annotations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
