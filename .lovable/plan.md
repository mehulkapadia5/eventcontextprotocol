

# ECP — Event Collection Platform

## Overview
A developer analytics platform that collects events via a lightweight SDK and displays them in a real-time dashboard. Built with Supabase for authentication, database, and event ingestion.

---

## Page 1: Landing Page
- Hero section explaining ECP's value — "Understand your users with simple event tracking"
- Before/After comparison showing messy analytics vs. clean ECP dashboard
- Features showcase (SDK, real-time dashboard, AI-ready data)
- Code snippet preview showing how easy the SDK is to integrate
- Email capture / waitlist signup form
- Responsive design with modern, developer-friendly aesthetic

## Page 2: Authentication
- Sign up / Log in pages using Supabase Auth (email + password)
- Protected routes — dashboard only accessible when logged in
- Password reset flow

## Page 3: Dashboard — Overview
- Summary cards: total events, unique users, events today, top event
- Line chart showing event volume over time (last 7/30 days)
- Bar chart of top 10 event types
- Recent events feed (live-updating list)

## Page 4: Dashboard — Events Explorer
- Searchable, filterable table of all tracked events
- Filter by event name, date range, user ID, and custom properties
- Event detail drawer showing full payload and context
- Export to CSV

## Page 5: Dashboard — Projects/Apps
- Users can create multiple projects (each gets a unique API key)
- Project settings: name, API key display, regenerate key
- Per-project event isolation

## Backend (Supabase)
- **Tables**: profiles, projects, events
- **Edge Function**: Event ingestion endpoint (receives events from SDK, validates API key, stores in events table)
- **RLS**: Users can only see their own projects and events
- **Auth**: Email/password signup with profile auto-creation

## SDK Preview
- A read-only code block on the landing page showing the SDK usage pattern (the actual npm SDK is out of scope for Lovable, but the ingestion API will be ready)

---

## Design Style
- Clean, modern developer-tool aesthetic
- Dark mode by default with light mode toggle
- Monospace fonts for code/data, sans-serif for UI
- Color palette: deep navy background, bright accent colors for charts

