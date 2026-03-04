

# Full Codebase Clone — Implementation Plan

## What We're Building

A pipeline that fully indexes a GitHub repository into the database, replacing the current shallow 20-file scan. This is Step 1 of the larger Codebase Indexer pipeline (index → search → analyze).

## Database Changes

### New Tables

**`repo_files`** — stores full file contents from GitHub
- `id` UUID PK, `project_id` UUID FK→projects (CASCADE), `file_path` TEXT, `content` TEXT, `file_size` INTEGER, `language` TEXT, `last_indexed_at` TIMESTAMPTZ
- Unique on `(project_id, file_path)`, indexes on `project_id` and `(project_id, file_path)`

**`repo_index_status`** — tracks indexing progress per project
- `id` UUID PK, `project_id` UUID FK→projects (CASCADE, UNIQUE), `github_url` TEXT, `total_files` INTEGER, `indexed_files` INTEGER, `status` TEXT (pending/indexing/completed/failed), `last_indexed_at` TIMESTAMPTZ, `error_message` TEXT, `created_at`, `updated_at`

**`event_code_locations`** — maps events to code locations (for later pipeline steps)
- `id` UUID PK, `project_id` UUID FK→projects, `event_name` TEXT, `file_path` TEXT, `line_number` INTEGER, `code_snippet` TEXT, `surrounding_context` TEXT, `semantic_meaning` TEXT, `created_at`, `updated_at`

**RLS**: Owner + admin access pattern using `is_project_owner()` and `has_role()`, same as `codebase_files`.

**RPC function**: `search_event_in_files(p_project_id, p_event_name)` — returns matching files using `position()`.

## Edge Function: `index-github-repo`

Core logic:
1. Accept `project_id`. Get `github_url`/`github_pat` from `profiles.onboarding_data`
2. Set `repo_index_status` to `indexing`
3. Fetch full tree via GitHub Trees API (`?recursive=1`)
4. Filter to code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.java`, `.kt`, `.swift`, `.vue`, `.svelte`, `.php`). Skip `node_modules`, `dist`, `build`, `.git`, vendor, lock files, binaries
5. Prioritize: components/pages/hooks/services/api/lib/utils folders first
6. Cap at 500 files
7. Fetch content in batches of 5 via Contents API, base64-decode, upsert into `repo_files`
8. Update `repo_index_status.indexed_files` after each batch
9. Handle 403/429 with exponential backoff
10. On completion, set status to `completed` with timestamp

Auth: Bearer JWT, same pattern as existing functions.

## Edge Functions: `search-events-in-codebase` and `analyze-event-semantics`

**`search-events-in-codebase`**: Fetches unique event names from `events` table, searches `repo_files` using the `search_event_in_files` RPC, extracts line numbers and ±10/±30 line context snippets, stores in `event_code_locations`.

**`analyze-event-semantics`**: Fetches `event_code_locations` grouped by event, sends batches of 5-10 events to AI (same LLM routing as existing functions), updates `semantic_meaning` and upserts `event_annotations` with status='verified'.

**`get-event-context`**: Simple retrieval — returns code locations and annotations by event name or file path.

## Frontend Changes

### `useCodebaseIndexer` hook
Orchestrates the 3-step pipeline:
```
Step 1: index-github-repo (poll repo_index_status for progress)
Step 2: search-events-in-codebase
Step 3: analyze-event-semantics
```
Exposes: `currentStep`, `progress`, `isRunning`, `runPipeline()`, `runStep()`, `indexStatus`.

### Event Dictionary UI enhancements
- **Indexer Status Card**: repo URL, status badge, progress bar (files indexed/total), "Index Codebase" / "Re-index" button, last indexed timestamp
- **Pipeline stepper**: 3-step visual indicator (Index → Search → Analyze) with "Discover Events from Code" button
- **Code Locations per event**: expandable row section showing file path, line number, code snippet, semantic meaning
- Helpful message if no events synced yet

## Config Updates

Add to `supabase/config.toml`:
```toml
[functions.index-github-repo]
verify_jwt = false

[functions.search-events-in-codebase]
verify_jwt = false

[functions.analyze-event-semantics]
verify_jwt = false

[functions.get-event-context]
verify_jwt = false
```

## Implementation Order

1. Database migration (3 tables + RLS + RPC)
2. `index-github-repo` edge function
3. `search-events-in-codebase` edge function
4. `analyze-event-semantics` edge function
5. `get-event-context` edge function
6. `useCodebaseIndexer` hook
7. Event Dictionary UI (status card, pipeline stepper, code locations)

