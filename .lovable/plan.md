

## Landing Page Overhaul — "Your AI Product Analyst"

Based on the earlier feedback and approved direction, here's the full plan:

### 1. Hero Section — Reposition + Single CTA
- New headline: **"Your AI Product Analyst"** with subtext "Connect your analytics, get actionable insights in minutes — no SQL required."
- Remove "See How It Works" button — keep only **"Get Started Free"**
- Add a social proof line above the fold: "Trusted by product teams worldwide"
- Add a small supported regions note: "Data hosted in US & EU"
- Keep demo video

### 2. Navbar — Simplify CTA
- Keep "Log In" as ghost button, remove "Get Started" as second button (hero handles it)
- Or: keep both but ensure only one visual style stands out

### 3. New: Testimonials Section
- Create `TestimonialsSection.tsx` with 3 placeholder testimonial cards (quote, name, role, company)
- Placed right after the hero for immediate social proof
- User will replace with real testimonials

### 4. Features Section — Rewrite for Non-Technical Audience
Replace developer-focused features with PM/founder-relevant ones:
- "Setup in 5 Minutes" — no engineering required
- "Ask in Plain English" — AI answers your product questions
- "Works With Your Tools" — Mixpanel, PostHog, GA, etc.
- "Context-Aware Analysis" — connects code changes to metric shifts
- "Enterprise Security" — per-project isolation, US & EU hosting
- "No SQL Required" — built for product teams

### 5. New: FAQ Section
- Create `FAQSection.tsx` using the accordion component
- Questions: What tools do you support? Do I need to write code? How is my data secured? What regions? Is there a free plan? How does AI analysis work?

### 6. CTA Section — Updated Copy
- Headline: "Ready to let AI analyze your product data?"
- Single button: "Get Started Free"

### 7. Footer
- Change "Built for product teams" (already done, just verify)

### 8. Page Order Update (`Index.tsx`)
Hero → Testimonials → How It Works → Features → FAQ → CTA → Footer

### Files
| Action | File |
|--------|------|
| Create | `src/components/landing/TestimonialsSection.tsx` |
| Create | `src/components/landing/FAQSection.tsx` |
| Modify | `src/components/landing/HeroSection.tsx` |
| Modify | `src/components/landing/Navbar.tsx` |
| Modify | `src/components/landing/FeaturesSection.tsx` |
| Modify | `src/components/landing/CTASection.tsx` |
| Modify | `src/pages/Index.tsx` |

