

# Fix: RLS Policy for Event Annotations Missing Admin Access

## Problem
The current user is an admin who can view all projects and events (those tables have "Admins can view all" policies), but the `event_annotations` table only allows INSERT/UPDATE/DELETE for project owners via `is_project_owner(project_id)`. Admins get a 403 error when trying to save annotations.

## Solution
Add admin access to the `event_annotations` INSERT, UPDATE, and DELETE RLS policies, matching the pattern used on other tables like `events` and `projects`.

## Changes

### 1. Database Migration
Add permissive admin policies for `event_annotations`:

```sql
-- Allow admins to insert annotations
CREATE POLICY "Admins can insert annotations"
  ON public.event_annotations FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to update annotations
CREATE POLICY "Admins can update annotations"
  ON public.event_annotations FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to delete annotations
CREATE POLICY "Admins can delete annotations"
  ON public.event_annotations FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all annotations
CREATE POLICY "Admins can view all annotations"
  ON public.event_annotations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

### 2. No code changes needed
The frontend upsert logic is correct -- the issue is purely a database permissions problem.

## Technical Note
The existing policies are restrictive (`Permissive: No`). The new admin policies should be **permissive** (the default) so they act as an alternative path -- either being the project owner OR being an admin grants access.

