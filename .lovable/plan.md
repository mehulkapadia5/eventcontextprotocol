

## Rename ECP → Magnitude

Global find-and-replace across all files where "ECP" appears as a brand name. Also update the HTML title, meta tags, and descriptions.

### Files to modify

| File | Changes |
|------|---------|
| `index.html` | Title "ECP" → "Magnitude", meta description update, og:title, twitter:title |
| `src/components/landing/Navbar.tsx` | Brand text "ECP" → "Magnitude" |
| `src/components/landing/Footer.tsx` | Brand text + copyright line |
| `src/components/landing/HeroSection.tsx` | "let ECP give you" → "let Magnitude give you" |
| `src/components/landing/HowItWorksSection.tsx` | "let ECP do the rest" + "ECP analyzes" |
| `src/components/landing/CTASection.tsx` | No ECP text currently, but update "Event Collection Platform" if present |
| `src/pages/Auth.tsx` | Brand text "ECP" → "Magnitude" |
| `src/pages/Dashboard.tsx` | Sidebar brand "ECP" → "Magnitude" |
| `src/components/onboarding/OnboardingWizard.tsx` | Brand text + toast message |
| `src/components/onboarding/OnboardingCards.tsx` | GitHub token description "ECP+Access" → "Magnitude+Access" |
| `src/components/onboarding/StepCodebase.tsx` | "ECP can provide" → "Magnitude can provide" |
| `supabase/functions/analytics-chat/index.ts` | System prompt "ECP's analytics assistant" |
| `supabase/functions/index-github-repo/index.ts` | User-Agent header |
| `supabase/functions/fetch-github-context/index.ts` | User-Agent header |

All remaining files referencing "Event Collection Platform" will also be updated to "Magnitude".

Font style will shift from `font-mono` to a cleaner `font-semibold tracking-tight` to better suit the new name.

