

# Fix Event Sync: Incremental Deduplication and Accurate Totals

## Problem
1. Every sync blindly fetches the latest 500 events and inserts them, creating duplicates. Users/events numbers don't grow -- they just multiply.
2. The dashboard overview query limits to 1000 rows, so stats are always based on a small window rather than the full accumulated dataset.

## Solution

### 1. Add a `last_synced_at` column to `projects` table
Track when each project last synced so we only fetch events newer than that timestamp.

### 2. Add a unique constraint on `events` to prevent duplicates
Add a composite unique index on `(project_id, event_name, user_identifier, timestamp)` so duplicate inserts are ignored via upsert.

### 3. Update `fetch-external-events` edge function
- Query the project's `last_synced_at` to determine the start date
- For PostHog: add a `WHERE timestamp > last_synced_at` filter to the HogQL query
- For Mixpanel: use `last_synced_at` as the `from_date` instead of hardcoded 7 days
- For GA4: use `last_synced_at` as the `startDate`
- For Supabase: add a `.gt('created_at', last_synced_at)` filter
- Use `.upsert()` with `onConflict` instead of `.insert()` to skip duplicates
- After successful insert, update `last_synced_at` on the project to `now()`
- Add pagination: loop until fewer than 500 results are returned (for PostHog/Mixpanel)

### 4. Fix dashboard overview to use aggregate counts instead of row limits
- Replace the events query (which fetches 1000 raw rows) with targeted aggregate queries:
  - Total events count: `select count` with `head: true`
  - Unique users: a dedicated `COUNT(DISTINCT user_identifier)` via an RPC or raw count
  - Events today: filtered count query
  - Top events: a grouped count query
  - Volume chart and recent events: keep limited queries but only for display purposes
- This ensures stats reflect ALL accumulated data, not just the first 1000 rows

## Technical Details

### Database Migration
```sql
-- Add last_synced_at to projects
ALTER TABLE projects ADD COLUMN last_synced_at timestamptz DEFAULT NULL;

-- Add unique index to prevent duplicate events
CREATE UNIQUE INDEX events_dedup_idx 
ON events (project_id, event_name, user_identifier, timestamp)
NULLS NOT DISTINCT;
```

### Edge Function Changes (`fetch-external-events/index.ts`)
- Read `last_synced_at` from the project row before fetching
- Pass the timestamp as a filter to each provider's API call
- Switch from `.insert()` to `.upsert(..., { onConflict: 'project_id,event_name,user_identifier,timestamp', ignoreDuplicates: true })`
- After success, run `UPDATE projects SET last_synced_at = now() WHERE id = projectId`

### Dashboard Changes (`DashboardOverview.tsx`)
- Replace single `.select("*").limit(1000)` with:
  - A count query for total events (using `{ count: 'exact', head: true }`)
  - A limited query for recent events display (keep `.limit(20)` for the table)
  - Aggregate queries via `execute_readonly_query` RPC for charts (top events, daily volume)
- This way stats always reflect the full dataset regardless of size

### Admin Events Changes (`AdminEvents.tsx`)
- Same pattern: use count queries for totals, keep row-level queries only for display tables
