
-- Secure read-only SQL execution function for AI analytics
-- Uses SECURITY INVOKER so RLS policies still apply
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET statement_timeout = '10s'
SET search_path = 'public'
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow SELECT/WITH statements
  IF NOT (lower(trim(query_text)) ~ '^(select|with)\s') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous keywords
  IF lower(query_text) ~ '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute)\b' THEN
    RAISE EXCEPTION 'Modifying queries are not allowed';
  END IF;

  EXECUTE format('SELECT json_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
