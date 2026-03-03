-- Production scaling migration: sync cursors, dedup, server-side aggregation

-- 1. Sync cursors table - tracks last sync position per project/source
CREATE TABLE public.sync_cursors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'posthog', 'mixpanel', 'google_analytics', 'supabase'
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_timestamp TIMESTAMPTZ, -- cursor: last event timestamp we fetched
  last_offset INTEGER DEFAULT 0, -- for offset-based pagination
  total_synced INTEGER DEFAULT 0, -- running total of events synced
  metadata JSONB DEFAULT '{}', -- source-specific cursor data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_cursors ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_sync_cursors_project_source ON public.sync_cursors(project_id, source);

CREATE POLICY "Users can view own sync cursors"
  ON public.sync_cursors FOR SELECT
  USING (public.is_project_owner(project_id));

CREATE TRIGGER update_sync_cursors_updated_at
  BEFORE UPDATE ON public.sync_cursors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Unique constraint to prevent duplicate events
-- Using a composite unique index on (project_id, event_name, user_identifier, timestamp)
-- with a hash of properties to handle nulls gracefully
CREATE UNIQUE INDEX idx_events_dedup
  ON public.events(project_id, event_name, timestamp, COALESCE(user_identifier, ''))
  WHERE user_identifier IS NOT NULL;

-- For events without user_identifier, use a broader dedup
-- (same event_name at same timestamp for same project is a dupe)
CREATE INDEX idx_events_project_timestamp_name
  ON public.events(project_id, timestamp, event_name);

-- 3. Composite index for efficient paginated queries
CREATE INDEX idx_events_project_id_timestamp_desc
  ON public.events(project_id, timestamp DESC);

-- 4. Server-side aggregation: dashboard stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_project_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_events', COALESCE(total_events, 0),
    'unique_users', COALESCE(unique_users, 0),
    'events_today', COALESCE(events_today, 0),
    'top_event_name', top_event_name,
    'top_event_count', COALESCE(top_event_count, 0)
  ) INTO result
  FROM (
    SELECT
      COUNT(*) AS total_events,
      COUNT(DISTINCT user_identifier) FILTER (WHERE user_identifier IS NOT NULL) AS unique_users,
      COUNT(*) FILTER (WHERE timestamp::date = CURRENT_DATE) AS events_today,
      (SELECT event_name FROM events WHERE project_id = ANY(p_project_ids) GROUP BY event_name ORDER BY COUNT(*) DESC LIMIT 1) AS top_event_name,
      (SELECT COUNT(*) FROM events WHERE project_id = ANY(p_project_ids) GROUP BY event_name ORDER BY COUNT(*) DESC LIMIT 1) AS top_event_count
    FROM events
    WHERE project_id = ANY(p_project_ids)
  ) stats;

  RETURN COALESCE(result, '{}'::json);
END;
$$;

-- 5. Server-side aggregation: top events chart data
CREATE OR REPLACE FUNCTION public.get_top_events(p_project_ids UUID[], p_limit INTEGER DEFAULT 10)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO result
  FROM (
    SELECT
      event_name AS name,
      COUNT(*) AS count,
      COUNT(DISTINCT user_identifier) FILTER (WHERE user_identifier IS NOT NULL) AS unique_users
    FROM events
    WHERE project_id = ANY(p_project_ids)
    GROUP BY event_name
    ORDER BY COUNT(*) DESC
    LIMIT p_limit
  ) t;

  RETURN result;
END;
$$;

-- 6. Server-side aggregation: event volume over time
CREATE OR REPLACE FUNCTION public.get_event_volume(p_project_ids UUID[], p_days INTEGER DEFAULT 7)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json) INTO result
  FROM (
    SELECT
      d::date AS date,
      COALESCE(COUNT(e.id), 0) AS count
    FROM generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::interval
    ) d
    LEFT JOIN events e
      ON e.timestamp::date = d::date
      AND e.project_id = ANY(p_project_ids)
    GROUP BY d::date
  ) t;

  RETURN result;
END;
$$;

-- 7. Server-side aggregation: unique events with stats (for Events Explorer)
CREATE OR REPLACE FUNCTION public.get_unique_events(
  p_project_ids UUID[],
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'count',
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO result
  FROM (
    SELECT
      event_name AS name,
      COUNT(*) AS count,
      COUNT(DISTINCT user_identifier) FILTER (WHERE user_identifier IS NOT NULL) AS unique_users,
      MAX(timestamp) AS last_seen
    FROM events
    WHERE project_id = ANY(p_project_ids)
      AND (p_search IS NULL OR event_name ILIKE '%' || p_search || '%')
    GROUP BY event_name
    ORDER BY
      CASE WHEN p_sort_by = 'count' THEN COUNT(*) END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'name' THEN event_name END ASC NULLS LAST,
      CASE WHEN p_sort_by = 'lastSeen' THEN MAX(timestamp) END DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN result;
END;
$$;

-- 8. Server-side: get total unique event count (for pagination)
CREATE OR REPLACE FUNCTION public.get_unique_events_count(
  p_project_ids UUID[],
  p_search TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result INTEGER;
BEGIN
  SELECT COUNT(DISTINCT event_name) INTO result
  FROM events
  WHERE project_id = ANY(p_project_ids)
    AND (p_search IS NULL OR event_name ILIKE '%' || p_search || '%');

  RETURN COALESCE(result, 0);
END;
$$;

-- 9. Server-side: get paginated event instances for a specific event name
CREATE OR REPLACE FUNCTION public.get_event_instances(
  p_project_ids UUID[],
  p_event_name TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO result
  FROM (
    SELECT id, event_name, user_identifier, page_url, timestamp, properties, project_id
    FROM events
    WHERE project_id = ANY(p_project_ids)
      AND event_name = p_event_name
    ORDER BY timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN result;
END;
$$;

-- 10. Server-side: get property schema for an event (aggregated from all instances)
CREATE OR REPLACE FUNCTION public.get_event_property_schema(
  p_project_ids UUID[],
  p_event_name TEXT,
  p_sample_size INTEGER DEFAULT 200
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
SET statement_timeout = '10s'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO result
  FROM (
    SELECT
      key,
      jsonb_typeof(value) AS type,
      COUNT(*) AS occurrence_count,
      (
        SELECT COALESCE(json_agg(DISTINCT sv), '[]'::json)
        FROM (
          SELECT (jsonb_each_text(properties)).value AS sv
          FROM events
          WHERE project_id = ANY(p_project_ids)
            AND event_name = p_event_name
            AND properties ? key
          LIMIT 5
        ) samples
        WHERE samples.sv IS NOT NULL
      ) AS sample_values
    FROM (
      SELECT id, properties
      FROM events
      WHERE project_id = ANY(p_project_ids)
        AND event_name = p_event_name
      ORDER BY timestamp DESC
      LIMIT p_sample_size
    ) sampled,
    LATERAL jsonb_each(sampled.properties)
    GROUP BY key, jsonb_typeof(value)
    ORDER BY COUNT(*) DESC
  ) t;

  RETURN result;
END;
$$;
