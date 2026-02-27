-- First, remove duplicate events keeping only the earliest inserted row
DELETE FROM events
WHERE id NOT IN (
  SELECT DISTINCT ON (project_id, event_name, user_identifier, timestamp) id
  FROM events
  ORDER BY project_id, event_name, user_identifier, timestamp, created_at ASC
);

-- Now add the unique index
CREATE UNIQUE INDEX events_dedup_idx 
ON events (project_id, event_name, user_identifier, timestamp)
NULLS NOT DISTINCT;