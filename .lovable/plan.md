
# Deep Codebase Event Indexing

## Overview
Enhance the GitHub integration to scan actual source code files for tracking calls (e.g., `posthog.capture()`, `analytics.track()`), store the results, and surface them in the Event Dictionary. Currently, event discovery only reads README/package.json and guesses from file names.

## Changes

### 1. Database Migration
Create a `codebase_files` table and add RLS policies:

```text
codebase_files
--------------
id            uuid (PK, default gen_random_uuid())
project_id    uuid (NOT NULL, references projects.id ON DELETE CASCADE)
file_path     text (NOT NULL)
content_snippet text  -- ~50 lines around each tracking call
has_tracking_calls boolean (default false)
last_synced_at timestamptz (default now())
created_at    timestamptz (default now())
UNIQUE(project_id, file_path)
```

RLS policies:
- Project owners can SELECT, INSERT, UPDATE, DELETE (via `is_project_owner`)
- Admins can SELECT, INSERT, UPDATE, DELETE (via `has_role('admin')`)

### 2. New Edge Function: `index-codebase-events`

**File**: `supabase/functions/index-codebase-events/index.ts`

Flow:
1. Accepts `{ project_id, github_url, github_pat? }` with auth header
2. Fetches the repo file tree from GitHub API
3. Filters for source files (`.ts`, `.tsx`, `.js`, `.jsx`, `.py`), skipping `node_modules`, `dist`, test files, `.d.ts`
4. Prioritizes files with keywords: `analytics`, `tracking`, `events`, `posthog`, `mixpanel`, `gtag`, `segment`
5. Fetches up to 20 source files via GitHub Contents API
6. Applies regex to find tracking calls:
   - `\.(capture|track|logEvent|send)\s*\(\s*['"]([^'"]+)['"]`
   - `gtag\s*\(\s*['"]event['"]\s*,\s*['"]([^'"]+)['"]`
7. Extracts ~50-line snippets around each match and saves to `codebase_files`
8. Sends extracted snippets to Lovable AI (Gemini) for business-meaning interpretation
9. Upserts results into `event_annotations` with status `"discovered"` and a source marker

### 3. Update `fetch-github-context`

**File**: `supabase/functions/fetch-github-context/index.ts`

Add source file scanning alongside existing metadata fetch:
- After fetching the file tree, identify tracking-relevant source files using the same heuristic as above
- Fetch their contents (up to 15 files) and include a `tracking_snippets` section in the response
- This enriches the context saved to `profiles.onboarding_data` so the chat AI also benefits

### 4. Update Event Dictionary UI

**File**: `src/components/dashboard/EventDictionary.tsx`

- Add a "Re-scan Codebase" button (only visible when a GitHub URL is configured)
- Clicking it calls the `index-codebase-events` function
- Show a loading/progress state during scanning
- Add a "Source" badge on events indicating origin: "codebase", "live", or "manual"
- The source is determined by: if event exists in `codebase_files` -> "codebase", if it has live count but no annotation -> "live", if manually added -> "manual"

### 5. Wire into Onboarding

**File**: `src/components/onboarding/StepCodebase.tsx`

- When user clicks "Save" after entering a GitHub URL, automatically trigger `index-codebase-events` in the background
- Show a brief "Scanning codebase for events..." toast
- This pre-populates the Event Dictionary before the user reaches it

### 6. Config Update

**File**: `supabase/config.toml`

Add:
```toml
[functions.index-codebase-events]
verify_jwt = false
```

## Technical Details

### File Selection Priority
```text
Priority 1: Path contains "analytics", "tracking", "events", "posthog", "mixpanel", "gtag", "segment"
Priority 2: Files in src/ with .ts/.tsx/.js/.jsx extension
Skip: node_modules/, dist/, build/, .test., .spec., .d.ts, images, fonts, .css, .json
Limit: 20 files max
```

### Tracking Regex Patterns
```text
\.(capture|track|logEvent|send)\s*\(\s*['"]([^'"]+)['"]
gtag\s*\(\s*['"]event['"]\s*,\s*['"]([^'"]+)['"]
```

### AI Model
Uses Lovable AI gateway (`google/gemini-3-flash-preview`) with the existing `LOVABLE_API_KEY`, falling back to user-configured LLM if set in their profile. Same pattern as existing `discover-events` and `enrich-event-dictionary` functions.

## Files Summary
- **Create**: `supabase/functions/index-codebase-events/index.ts`
- **Create**: Database migration for `codebase_files` table + RLS
- **Modify**: `supabase/functions/fetch-github-context/index.ts` -- add source file fetching
- **Modify**: `src/components/dashboard/EventDictionary.tsx` -- add Re-scan button + source badges
- **Modify**: `src/components/onboarding/StepCodebase.tsx` -- trigger scan on save
- **Modify**: `supabase/config.toml` -- add new function config
