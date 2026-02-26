
-- Create codebase_files table for storing indexed source code snippets
CREATE TABLE public.codebase_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  content_snippet text,
  has_tracking_calls boolean DEFAULT false,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, file_path)
);

-- Enable RLS
ALTER TABLE public.codebase_files ENABLE ROW LEVEL SECURITY;

-- Project owner policies
CREATE POLICY "Owners can select codebase_files"
  ON public.codebase_files FOR SELECT
  TO authenticated
  USING (is_project_owner(project_id));

CREATE POLICY "Owners can insert codebase_files"
  ON public.codebase_files FOR INSERT
  TO authenticated
  WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Owners can update codebase_files"
  ON public.codebase_files FOR UPDATE
  TO authenticated
  USING (is_project_owner(project_id));

CREATE POLICY "Owners can delete codebase_files"
  ON public.codebase_files FOR DELETE
  TO authenticated
  USING (is_project_owner(project_id));

-- Admin policies
CREATE POLICY "Admins can select codebase_files"
  ON public.codebase_files FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert codebase_files"
  ON public.codebase_files FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update codebase_files"
  ON public.codebase_files FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete codebase_files"
  ON public.codebase_files FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
