const features = [
  { tag: "01 · Query", title: "Plain English Analytics", desc: 'Ask "why did conversions drop?" and get a real answer — not a chart that makes you do the thinking.' },
  { tag: "02 · Explore", title: "Event Explorer", desc: "Browse all your tracked events in one place. Understand what fires, when, and why — without opening your codebase." },
  { tag: "03 · Memory", title: "Persistent Context", desc: "Magnitude remembers your business context across sessions. Every answer is informed by what matters to you." },
  { tag: "04 · Diagnose", title: "Code-Aware Insights", desc: "When events go missing or look wrong, Magnitude cross-references your GitHub to find the root cause." },
  { tag: "05 · Connect", title: "Multi-Source Sync", desc: "PostHog, Mixpanel, GA4, Metabase, Supabase — all in one place. One question, all your data." },
  { tag: "06 · Ship", title: "Instant Setup", desc: "4-step onboarding. No data warehouse required. No SQL. Go from zero to insights in under 10 minutes." },
];

export function FeaturesSection() {
  return (
    <section id="features" className="px-6 md:px-12 py-20" style={{ background: "#0a0a0f", color: "#f5f3ee", fontFamily: "'Mona Sans', sans-serif" }}>
      <div className="max-w-[1200px] mx-auto">
        <h2 className="font-bold" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-1.5px", marginBottom: 12 }}>
          Built for product teams.
        </h2>
        <p style={{ color: "rgba(245,243,238,0.5)", fontSize: 17, marginBottom: 60 }}>
          Not data engineers. Not analysts. You.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 2 }}>
          {features.map((f) => (
            <div
              key={f.tag}
              className="p-9 transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="inline-block mb-4 font-mono text-[11px] uppercase" style={{ letterSpacing: "0.08em", color: "#e8ff47" }}>
                {f.tag}
              </span>
              <h3 className="font-bold text-xl mb-2.5">{f.title}</h3>
              <p className="text-sm" style={{ color: "rgba(245,243,238,0.5)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
