
-- Add unique constraint for upsert on event_annotations
ALTER TABLE public.event_annotations
ADD CONSTRAINT event_annotations_event_name_project_id_key UNIQUE (event_name, project_id);
