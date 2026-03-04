
-- 1. repo_files table
CREATE TABLE public.repo_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  file_size INTEGER,
  language TEXT,
  last_indexed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, file_path)
);
CREATE INDEX idx_repo_files_project ON public.repo_files(project_id);
CREATE INDEX idx_repo_files_path ON public.repo_files(project_id, file_path);

ALTER TABLE public.repo_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select repo_files" ON public.repo_files FOR SELECT TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can insert repo_files" ON public.repo_files FOR INSERT TO authenticated WITH CHECK (is_project_owner(project_id));
CREATE POLICY "Owners can update repo_files" ON public.repo_files FOR UPDATE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can delete repo_files" ON public.repo_files FOR DELETE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Admins can select repo_files" ON public.repo_files FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert repo_files" ON public.repo_files FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update repo_files" ON public.repo_files FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete repo_files" ON public.repo_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. repo_index_status table
CREATE TABLE public.repo_index_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  github_url TEXT,
  total_files INTEGER DEFAULT 0,
  indexed_files INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  last_indexed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.repo_index_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select repo_index_status" ON public.repo_index_status FOR SELECT TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can insert repo_index_status" ON public.repo_index_status FOR INSERT TO authenticated WITH CHECK (is_project_owner(project_id));
CREATE POLICY "Owners can update repo_index_status" ON public.repo_index_status FOR UPDATE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can delete repo_index_status" ON public.repo_index_status FOR DELETE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Admins can select repo_index_status" ON public.repo_index_status FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert repo_index_status" ON public.repo_index_status FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update repo_index_status" ON public.repo_index_status FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete repo_index_status" ON public.repo_index_status FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. event_code_locations table
CREATE TABLE public.event_code_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  code_snippet TEXT NOT NULL,
  surrounding_context TEXT,
  semantic_meaning TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_ecl_project_event ON public.event_code_locations(project_id, event_name);
CREATE INDEX idx_ecl_project_file ON public.event_code_locations(project_id, file_path);

ALTER TABLE public.event_code_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select event_code_locations" ON public.event_code_locations FOR SELECT TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can insert event_code_locations" ON public.event_code_locations FOR INSERT TO authenticated WITH CHECK (is_project_owner(project_id));
CREATE POLICY "Owners can update event_code_locations" ON public.event_code_locations FOR UPDATE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Owners can delete event_code_locations" ON public.event_code_locations FOR DELETE TO authenticated USING (is_project_owner(project_id));
CREATE POLICY "Admins can select event_code_locations" ON public.event_code_locations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert event_code_locations" ON public.event_code_locations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update event_code_locations" ON public.event_code_locations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete event_code_locations" ON public.event_code_locations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. RPC function for searching events in files
CREATE OR REPLACE FUNCTION public.search_event_in_files(p_project_id UUID, p_event_name TEXT)
RETURNS TABLE(file_path TEXT, content TEXT, file_size INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT file_path, content, file_size
  FROM public.repo_files
  WHERE project_id = p_project_id
    AND position(p_event_name IN content) > 0;
$$;
