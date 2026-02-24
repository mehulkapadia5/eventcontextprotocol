CREATE TABLE public.event_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- e.g., 'acquisition', 'retention', 'core'
  status TEXT DEFAULT 'discovered', -- 'discovered', 'verified', 'deprecated'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, event_name)
);

-- Enable RLS
ALTER TABLE public.event_annotations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view annotations for own projects" 
ON public.event_annotations FOR SELECT 
USING (is_project_owner(project_id));

CREATE POLICY "Users can insert annotations for own projects" 
ON public.event_annotations FOR INSERT 
WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Users can update annotations for own projects" 
ON public.event_annotations FOR UPDATE 
USING (is_project_owner(project_id));

CREATE POLICY "Users can delete annotations for own projects" 
ON public.event_annotations FOR DELETE 
USING (is_project_owner(project_id));

-- Trigger for updated_at
CREATE TRIGGER update_event_annotations_updated_at
BEFORE UPDATE ON public.event_annotations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();