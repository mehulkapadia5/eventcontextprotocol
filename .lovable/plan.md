

# Tighten AI Context Window Around Event Names

## Problem
The codebase scanner currently extracts ~50 lines (25 before + 25 after) around each tracking call. This sends a lot of irrelevant code to the AI, wastes tokens, and may dilute the interpretation quality. The logs also show "Found 0 tracking calls" which suggests the regex patterns may not be matching the target repo's tracking style.

## Changes

### 1. Reduce snippet window from 25 to 5 lines (`index-codebase-events`)

In `extractTrackingCalls`, change the context window from 25 lines to **5 lines** before and after the tracking call. This keeps the AI focused on:
- The function/method wrapping the event
- The properties object being passed
- Nearby comments explaining intent

```text
Before: lines (lineNum - 25) to (lineNum + 25) = ~50 lines
After:  lines (lineNum - 5)  to (lineNum + 5)  = ~10 lines
```

### 2. Add more tracking patterns

The current regex only catches `.capture()`, `.track()`, `.logEvent()`, `.send()`, and `gtag()`. Expand to also catch:
- `analytics.identify` / `analytics.page` / `analytics.group`
- `posthog.capture` with property objects
- `mixpanel.track`
- Custom patterns like `trackEvent(`, `logAnalytics(`
- `window.dataLayer.push` (GTM)

New patterns:
```text
trackEvent\s*\(\s*['"]([\w.:\-/ ]+)['"]
logAnalytics\s*\(\s*['"]([\w.:\-/ ]+)['"]
dataLayer\.push\s*\(\s*\{[^}]*['"]event['"]\s*:\s*['"]([\w.:\-/ ]+)['"]
```

### 3. Update the AI prompt to be more focused

Refine the system prompt to explicitly instruct the AI to:
- Look at the function name and surrounding variable names for business context
- Look at property keys being passed with the event
- Infer the user action from the code context (button click handler, form submit, page load, etc.)

### 4. Apply same 5-line window in `fetch-github-context`

Update the tracking snippet extraction in `fetch-github-context` to also use a 5-line window (currently uses 10 lines, which is already tighter but should match).

## Technical Details

### Files Modified
- `supabase/functions/index-codebase-events/index.ts` -- reduce snippet window, add patterns, update prompt
- `supabase/functions/fetch-github-context/index.ts` -- reduce snippet window to 5 lines, add same new patterns

### Snippet Size Impact
- Before: ~50 lines x 20 events = ~1000 lines sent to AI
- After: ~10 lines x 20 events = ~200 lines sent to AI
- Result: faster, cheaper, more focused interpretations
