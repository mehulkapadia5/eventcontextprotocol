

# Onboarding Flow — "Get Started" Setup Wizard

## Overview
Add a 3-step onboarding wizard that appears after a user signs up (or when they haven't completed setup). The steps guide users through connecting their tools and providing business context before they reach the main dashboard.

## Step Names and Content

1. **Connect Analytics** — Connect PostHog or Mixpanel to import existing event data
2. **Connect Codebase** — Link a GitHub repository for code-aware insights
3. **Business Context** — Describe your product, audience, and goals so ECP can tailor the experience

## How It Works

- A new `onboarding_completed` boolean column is added to the `profiles` table (default `false`).
- When a user lands on `/dashboard` and `onboarding_completed` is `false`, they are shown the onboarding wizard instead of the normal dashboard content.
- Each step collects information and stores it in a new `onboarding_data` JSONB column on `profiles`.
- Users can skip individual steps but must click through all 3 to finish onboarding.
- On completion, `onboarding_completed` is set to `true` and the user sees the normal dashboard.

## UI Design

- Full-page card-based wizard centered on screen
- Progress indicator at the top showing steps 1/2/3
- Each step has a title, description, icon, and action area
- "Skip" and "Continue" buttons on each step
- Clean, minimal design matching the existing dark developer aesthetic

### Step 1: Connect Analytics
- Two cards: PostHog and Mixpanel logos/names
- Each card has a "Connect" button (opens a text input for API key)
- Skip option available

### Step 2: Connect Codebase
- GitHub card with "Connect Repository" button
- Input for repository URL or integration prompt
- Skip option available

### Step 3: Business Context
- Text area for product description
- Dropdown or input for industry/audience
- Text area for primary goals
- "Finish Setup" button

---

## Technical Details

### Database Migration
- Add two columns to `profiles`:
  - `onboarding_completed` (boolean, default false)
  - `onboarding_data` (jsonb, nullable)

### New Files
- `src/components/onboarding/OnboardingWizard.tsx` — Main wizard container with step state and progress bar
- `src/components/onboarding/StepAnalytics.tsx` — Step 1: PostHog/Mixpanel connection UI
- `src/components/onboarding/StepCodebase.tsx` — Step 2: GitHub connection UI
- `src/components/onboarding/StepBusinessContext.tsx` — Step 3: Business context form

### Modified Files
- `src/pages/Dashboard.tsx` — Check `onboarding_completed` from profile; if false, render `OnboardingWizard` instead of dashboard layout
- `src/hooks/use-auth.ts` — Optionally expose profile data alongside session

### Data Flow
1. Dashboard loads, queries `profiles` for current user
2. If `onboarding_completed === false`, render `OnboardingWizard`
3. Each step saves its data to local state
4. On final step completion, update `profiles` with `onboarding_data` JSON and set `onboarding_completed = true`
5. Dashboard re-renders with normal content

### Notes
- The actual PostHog/Mixpanel/GitHub integrations are UI-only for now (collecting keys/URLs but not executing real connections). The backend integration logic can be built later.
- Onboarding can be re-triggered from a settings page in the future.
