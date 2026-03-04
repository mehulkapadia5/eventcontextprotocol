# Lovable Prompt: Full Codebase Indexer & AI-Powered Event Discovery

## What to Build

Build a **complete GitHub Codebase Indexer** system that:
1. Fetches and stores the full contents of a user's GitHub repository
2. Provides AI-agent-friendly search and retrieval tools over the indexed codebase
3. Runs an automated pipeline: fetch PostHog event names → exact-match search in codebase → LLM semantic analysis → save enriched event dictionary

This replaces the current limited `fetch-github-context` approach (which only grabs 200 file paths and a few key files) with a full codebase storage and indexing system.

---

## Part 1: Database Schema (New Migration)

Create a new migration file with these tables:

### `repo_files` — Stores every indexed file from the GitHub repo

```sql
CREATE TABLE public.repo_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  language TEXT,  -- detected from extension: 'typescript', 'python', etc.
  file_hash TEXT, -- SHA hash from GitHub, used for incremental re-indexing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, file_path)
);

ALTER TABLE public.repo_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_repo_files_project ON public.repo_files(project_id);
CREATE INDEX idx_repo_files_language ON public.repo_files(project_id, language);

-- Full-text search index for AI agent queries
CREATE INDEX idx_repo_files_content_trgm ON public.repo_files USING gin (content gin_trgm_ops);

-- Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE POLICY "Users can view own repo files"
  ON public.repo_files FOR SELECT
  USING (public.is_project_owner(project_id));

CREATE POLICY "Users can manage own repo files"
  ON public.repo_files FOR ALL
  USING (public.is_project_owner(project_id));

CREATE TRIGGER update_repo_files_updated_at
  BEFORE UPDATE ON public.repo_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### `event_code_locations` — Where each event appears in the codebase

```sql
CREATE TABLE public.event_code_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  code_snippet TEXT NOT NULL,        -- the exact line(s) containing the event
  surrounding_context TEXT,           -- ~30 lines around the match for LLM analysis
  semantic_meaning TEXT,              -- LLM-generated explanation of this specific usage
  function_name TEXT,                 -- which function/component contains this event call
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_code_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ecl_project_event ON public.event_code_locations(project_id, event_name);
CREATE INDEX idx_ecl_project_file ON public.event_code_locations(project_id, file_path);

CREATE POLICY "Users can view own event code locations"
  ON public.event_code_locations FOR SELECT
  USING (public.is_project_owner(project_id));

CREATE POLICY "Users can manage own event code locations"
  ON public.event_code_locations FOR ALL
  USING (public.is_project_owner(project_id));

CREATE TRIGGER update_ecl_updated_at
  BEFORE UPDATE ON public.event_code_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### `repo_index_status` — Tracks indexing progress and state

```sql
CREATE TABLE public.repo_index_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  github_owner TEXT,
  github_repo TEXT,
  github_branch TEXT DEFAULT 'main',
  status TEXT NOT NULL DEFAULT 'idle',  -- 'idle', 'fetching', 'indexing', 'searching', 'analyzing', 'completed', 'failed'
  total_files INTEGER DEFAULT 0,
  indexed_files INTEGER DEFAULT 0,
  total_events_found INTEGER DEFAULT 0,
  events_analyzed INTEGER DEFAULT 0,
  error_message TEXT,
  last_indexed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repo_index_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own repo index status"
  ON public.repo_index_status FOR SELECT
  USING (public.is_project_owner(project_id));

CREATE POLICY "Users can manage own repo index status"
  ON public.repo_index_status FOR ALL
  USING (public.is_project_owner(project_id));

CREATE TRIGGER update_repo_index_status_updated_at
  BEFORE UPDATE ON public.repo_index_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### Server-side search function for AI agent use

```sql
-- Search codebase files by text pattern (for AI agent)
CREATE OR REPLACE FUNCTION public.search_codebase(
  p_project_id UUID,
  p_query TEXT,
  p_file_pattern TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  file_path TEXT,
  language TEXT,
  line_number INTEGER,
  matched_line TEXT,
  surrounding_lines TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH matches AS (
    SELECT
      rf.file_path,
      rf.language,
      rf.content,
      -- Find all positions of the query in the content
      unnest(
        string_to_array(
          array_to_string(
            ARRAY(
              SELECT (row_number() OVER ())::integer
              FROM unnest(string_to_array(rf.content, E'\n')) WITH ORDINALITY AS lines(line, num)
              WHERE line ILIKE '%' || p_query || '%'
            ),
            ','
          ),
          ','
        )
      )::integer AS match_line_num
    FROM repo_files rf
    WHERE rf.project_id = p_project_id
      AND rf.content ILIKE '%' || p_query || '%'
      AND (p_file_pattern IS NULL OR rf.file_path LIKE p_file_pattern)
      AND (p_language IS NULL OR rf.language = p_language)
  )
  SELECT
    m.file_path,
    m.language,
    m.match_line_num AS line_number,
    (string_to_array(m.content, E'\n'))[m.match_line_num] AS matched_line,
    array_to_string(
      (string_to_array(m.content, E'\n'))[GREATEST(1, m.match_line_num - 5):LEAST(array_length(string_to_array(m.content, E'\n'), 1), m.match_line_num + 5)],
      E'\n'
    ) AS surrounding_lines
  FROM matches m
  LIMIT p_limit;
END;
$$;

-- Get file content by path (for AI agent)
CREATE OR REPLACE FUNCTION public.get_repo_file(
  p_project_id UUID,
  p_file_path TEXT
)
RETURNS TABLE(file_path TEXT, content TEXT, language TEXT, file_size INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rf.file_path, rf.content, rf.language, rf.file_size
  FROM repo_files rf
  WHERE rf.project_id = p_project_id AND rf.file_path = p_file_path;
END;
$$;

-- List repo file tree (for AI agent)
CREATE OR REPLACE FUNCTION public.list_repo_files(
  p_project_id UUID,
  p_directory TEXT DEFAULT NULL,
  p_language TEXT DEFAULT NULL
)
RETURNS TABLE(file_path TEXT, language TEXT, file_size INTEGER)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT rf.file_path, rf.language, rf.file_size
  FROM repo_files rf
  WHERE rf.project_id = p_project_id
    AND (p_directory IS NULL OR rf.file_path LIKE p_directory || '%')
    AND (p_language IS NULL OR rf.language = p_language)
  ORDER BY rf.file_path;
END;
$$;
```

---

## Part 2: Edge Function — `index-github-repo`

Create a new Supabase edge function that fetches and stores the entire repo.

**Location**: `supabase/functions/index-github-repo/index.ts`

### Logic:

1. **Input**: `{ project_id }` + Bearer JWT auth token
2. **Get GitHub credentials**: Read `github_url` and `github_pat` from `profiles.onboarding_data.codebase`
3. **Parse repo URL**: Extract `owner` and `repo` from the GitHub URL
4. **Upsert `repo_index_status`**: Set status = 'fetching', store owner/repo/branch
5. **Fetch file tree**: `GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1`
6. **Filter files**: Only keep code files based on extension:
   - **Include**: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.java`, `.kt`, `.swift`, `.vue`, `.svelte`, `.php`, `.cs`, `.cpp`, `.c`, `.h`, `.rs`, `.scala`, `.ex`, `.exs`, `.dart`, `.lua`, `.sh`, `.yaml`, `.yml`, `.json`, `.toml`, `.md`, `.html`, `.css`, `.scss`, `.sql`
   - **Exclude directories**: `node_modules`, `dist`, `build`, `.git`, `vendor`, `__pycache__`, `.next`, `.nuxt`, `coverage`, `.cache`, `target`, `bin`, `obj`, `.venv`, `env`, `venv`
   - **Exclude files**: lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, `poetry.lock`, `Cargo.lock`), `.min.js`, `.min.css`, `.map` files, files > 100KB
   - **Cap**: Maximum 1000 files per repo (prioritize by: source code in `src/`, `app/`, `lib/`, `components/`, `pages/`, `hooks/`, `services/`, `api/`, `utils/` folders first, then other code files)
7. **Fetch file contents in batches**: For each file, call `GET /repos/{owner}/{repo}/contents/{path}` which returns base64 content. Decode it.
   - Process 5 files concurrently (to respect GitHub rate limits)
   - After each batch, upsert into `repo_files` using the service role client
   - Update `repo_index_status.indexed_files` progress count
   - Handle rate limits: if 403/429 response, check `x-ratelimit-reset` header, wait, and retry
   - Use `file_hash` (SHA from tree response) to skip files that haven't changed on re-index
8. **Detect language from extension**: Map file extensions to language names (`.ts` → `typescript`, `.py` → `python`, etc.)
9. **On completion**: Update `repo_index_status` to status = 'completed', set `last_indexed_at`
10. **On error**: Update `repo_index_status` to status = 'failed', store `error_message`
11. **Incremental re-indexing**: When re-running, compare existing `file_hash` values with new tree. Only fetch files where hash changed. Delete `repo_files` entries for files no longer in tree.

### Rate limit strategy:
- Use authenticated requests (PAT) when available — 5000 requests/hour
- Without PAT — 60 requests/hour (will be very slow, show warning to user)
- Track remaining requests via `x-ratelimit-remaining` header
- If remaining < 10, pause until `x-ratelimit-reset` timestamp

### Important: Use service role client for writes
```typescript
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

---

## Part 3: Edge Function — `search-events-in-codebase`

**Location**: `supabase/functions/search-events-in-codebase/index.ts`

### Logic:

1. **Input**: `{ project_id }` + Bearer JWT auth
2. **Fetch event names**: Query `SELECT DISTINCT event_name FROM events WHERE project_id = $1` to get all PostHog event names
3. **Also fetch event_annotations**: Get any events already in the dictionary
4. **Combine**: Create a unique list of all known event names
5. **Search the codebase**: For each event name, run the `search_codebase` SQL function (or do a direct query on `repo_files`):
   ```sql
   SELECT file_path, content FROM repo_files
   WHERE project_id = $1 AND content LIKE '%' || $2 || '%'
   ```
6. **Extract snippets**: For each match, find the exact line number and extract:
   - `code_snippet`: The exact line containing the event name
   - `surrounding_context`: 15 lines above and 15 lines below (for LLM context)
   - `function_name`: Try to detect the enclosing function/component name by searching upward for `function`, `const`, `class`, `def`, etc.
7. **Store results**: Upsert into `event_code_locations` (delete old locations first for this project, then insert fresh)
8. **Update status**: Set `repo_index_status.status = 'searching'` during, then track `total_events_found`
9. **Return**: Summary of found events, locations count, and events with no matches

---

## Part 4: Edge Function — `analyze-event-semantics`

**Location**: `supabase/functions/analyze-event-semantics/index.ts`

### Logic:

1. **Input**: `{ project_id }` + Bearer JWT auth
2. **Fetch all code locations**: Get all `event_code_locations` grouped by `event_name`
3. **Fetch business context**: Get `profiles.onboarding_data.business` for product context
4. **For each event** (process in batches of 5), build an LLM prompt:

```
You are analyzing event tracking code to understand what each analytics event means.

Business Context:
- Product: {product_description}
- Audience: {audience}
- Goals: {goals}

Event: "{event_name}"

This event appears in {N} location(s) in the codebase:

--- Location 1: {file_path} (line {line_number}) ---
Function: {function_name}
```code
{surrounding_context}
```

--- Location 2: {file_path} (line {line_number}) ---
...

Analyze this event and return JSON:
{
  "description": "Business-friendly description of what this event means, when it fires, and why it matters",
  "category": "one of: acquisition, activation, retention, revenue, engagement, error, system, other",
  "trigger": "What user action or system event triggers this",
  "properties_captured": ["list of properties/data this event captures based on the code"],
  "locations_summary": "Brief explanation of why this event appears in multiple places (if applicable)",
  "semantic_meaning_per_location": [
    {
      "file_path": "...",
      "meaning": "In this specific context, this event is used to..."
    }
  ]
}
```

5. **Update event_code_locations**: Set `semantic_meaning` for each location
6. **Upsert event_annotations**: Update/insert with enriched `description`, `category`, `status = 'verified'`
7. **Use same LLM routing** as existing functions (support OpenAI, Anthropic, Google, Lovable gateway)

---

## Part 5: Edge Function — `codebase-agent-query`

**Location**: `supabase/functions/codebase-agent-query/index.ts`

This is the AI agent's interface to the codebase. It accepts structured queries and returns results.

### Supported operations:

```typescript
type AgentQuery =
  | { action: "search", query: string, file_pattern?: string, language?: string, limit?: number }
  | { action: "read_file", file_path: string }
  | { action: "list_files", directory?: string, language?: string }
  | { action: "get_event_context", event_name: string }
  | { action: "get_file_events", file_path: string }
  | { action: "get_index_status" }
  | { action: "get_event_dictionary" }
```

Each action maps to the corresponding SQL function or table query. The results are returned as structured JSON that any AI agent (analytics-chat, business-context-chat, etc.) can consume.

### Integrate with analytics-chat:

Update the `analytics-chat` edge function's SCHEMA_CONTEXT to include the new tables and the `search_codebase` function. The analytics chat AI should be able to:
- Search the codebase for event tracking patterns
- Look up where specific events are defined in code
- Understand the semantic meaning of events from code context

Add to `SCHEMA_CONTEXT` in analytics-chat:
```
TABLE: repo_files
- project_id (uuid), file_path (text), content (text), language (text), file_size (integer)

TABLE: event_code_locations
- project_id (uuid), event_name (text), file_path (text), line_number (integer),
  code_snippet (text), surrounding_context (text), semantic_meaning (text), function_name (text)

FUNCTION: search_codebase(p_project_id UUID, p_query TEXT, p_file_pattern TEXT, p_language TEXT, p_limit INTEGER)
- Searches file contents. Returns: file_path, language, line_number, matched_line, surrounding_lines

FUNCTION: get_repo_file(p_project_id UUID, p_file_path TEXT)
- Returns full file content

FUNCTION: list_repo_files(p_project_id UUID, p_directory TEXT, p_language TEXT)
- Lists files in the repo, optionally filtered by directory prefix or language
```

---

## Part 6: Frontend — Codebase Indexer UI

### 6a. New hook: `useCodebaseIndexer`

Create a hook at `src/hooks/useCodebaseIndexer.ts` that manages the full pipeline:

```typescript
export function useCodebaseIndexer(projectId: string) {
  // States
  const [status, setStatus] = useState<'idle' | 'fetching' | 'searching' | 'analyzing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState({ indexed: 0, total: 0, eventsFound: 0, eventsAnalyzed: 0 });

  // Poll repo_index_status for live progress
  // ... subscribe to repo_index_status changes via Supabase realtime or polling

  const indexRepo = async () => {
    // Step 1: Index repo
    await supabase.functions.invoke('index-github-repo', { body: { project_id: projectId } });
  };

  const searchEvents = async () => {
    // Step 2: Search events in codebase
    await supabase.functions.invoke('search-events-in-codebase', { body: { project_id: projectId } });
  };

  const analyzeSemantics = async () => {
    // Step 3: Semantic analysis
    await supabase.functions.invoke('analyze-event-semantics', { body: { project_id: projectId } });
  };

  const runFullPipeline = async () => {
    await indexRepo();
    await searchEvents();
    await analyzeSemantics();
  };

  return { status, progress, indexRepo, searchEvents, analyzeSemantics, runFullPipeline };
}
```

### 6b. Codebase Indexer Dashboard Card

Add a new card/section to the Dashboard (or create a new "Codebase" tab):

**When not indexed:**
- "Index Your Codebase" card with the GitHub URL shown
- "Start Indexing" button → triggers `runFullPipeline`
- Info text: "We'll fetch your codebase, find all event tracking calls, and build a semantic event dictionary."

**While indexing (3-step progress stepper):**
```
Step 1: Fetching Codebase    ✅ 247/247 files
Step 2: Searching Events      🔄 Finding event matches...
Step 3: Semantic Analysis     ⏳ Pending
```

**When completed:**
- Summary: "Indexed 247 files, found 34 events in 89 code locations"
- "Re-index" button
- Last indexed timestamp
- Link to Event Dictionary

### 6c. Enhanced Event Dictionary

In the existing Event Dictionary view (`EventDictionary.tsx` or similar), enhance each event entry:

**For each event row, add an expandable "Code Locations" section:**
- Shows each file where the event was found
- File path + line number (clickable to expand)
- Code snippet with syntax highlighting
- Semantic meaning per location
- Function/component name where it's called

**Event detail should show:**
- Event name
- Business description (from semantic analysis)
- Category badge
- Trigger description
- Properties captured
- Code locations (expandable list)
- Status (discovered → verified → deprecated)

### 6d. Codebase Browser (optional but nice)

A simple file tree viewer that shows indexed files:
- Left sidebar: file tree (from `list_repo_files`)
- Right panel: file content with line numbers
- Highlight lines where events are tracked
- Click on highlighted lines to see event annotation

---

## Part 7: Update Existing Functions

### Update `analytics-chat/index.ts`:
- Add the new tables to `SCHEMA_CONTEXT` (as described in Part 5)
- When the AI needs to understand an event, it can query `event_code_locations` and `event_annotations` together

### Update `business-context-chat/index.ts`:
- Instead of using the truncated `repo_context` string (currently limited to 8000 chars), query `repo_files` to get relevant file content
- Use `search_codebase` function to find specific patterns discussed in conversation

### Update `discover-events/index.ts`:
- Instead of sending truncated codebase to LLM, this function can now use `search_codebase` to find tracking patterns more precisely
- Or, this function becomes deprecated in favor of the new `search-events-in-codebase` pipeline

---

## Implementation Notes

1. **Follow existing patterns**: Use the same CORS headers, auth pattern (Bearer JWT), service role client for writes, and LLM routing (`getAIEndpoint`) as the existing edge functions.

2. **Edge function timeouts**: Supabase edge functions have a 60-second timeout. For large repos:
   - The `index-github-repo` function should process in chunks and return early with a "processing" status
   - The frontend should poll `repo_index_status` for progress
   - Consider breaking the fetching into multiple invocations if needed (process 100 files per invocation)

3. **Storage considerations**: `repo_files.content` can be large. For a typical repo with 500 files, this might be ~5-50MB of text. This is fine for PostgreSQL but consider:
   - Adding a `VACUUM` hint in the migration comments
   - The trigram index will consume significant space — only create it if the Supabase plan supports it
   - Alternative: Use Supabase Storage for file contents and only store metadata + search index in the table

4. **Deduplication**: The `UNIQUE(project_id, file_path)` constraint on `repo_files` handles re-indexing cleanly with upserts.

5. **Security**: All tables have RLS using `is_project_owner()` — same pattern as existing tables. The service role client bypasses RLS for edge function writes.

6. **TypeScript types**: Add the new tables to `src/integrations/supabase/types.ts` (Lovable auto-generates these from the schema).
