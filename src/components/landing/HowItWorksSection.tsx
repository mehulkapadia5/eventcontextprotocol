import { Code2, BarChart3, Brain } from "lucide-react";

const steps = [
  { num: "1", title: "Connect your analytics", desc: "Link PostHog, Mixpanel, GA4, Metabase, or Supabase. Magnitude syncs your events automatically." },
  { num: "2", title: "Link your codebase", desc: "Connect your GitHub repo so Magnitude understands what events mean in the context of your code." },
  { num: "3", title: "Add business context", desc: "Chat with AI to describe your product, goals, and KPIs. This becomes Magnitude's brain." },
  { num: "4", title: "Ask in plain English", desc: "No SQL needed. Just ask questions like you'd ask a data analyst sitting next to you." },
];

const contextCards = [
  {
    icon: BarChart3,
    colorClass: "purple",
    bg: "rgba(79,59,245,0.10)",
    title: "Event Context",
    desc: "7,133 events tracked · 151 unique users · top event: user_signed_in",
  },
  {
    icon: Code2,
    colorClass: "green",
    bg: "rgba(34,197,94,0.10)",
    title: "Codebase Context",
    desc: "GitHub connected · Magnitude reads your tracking code to understand event intent, not just names.",
  },
  {
    icon: Brain,
    colorClass: "orange",
    bg: "rgba(249,115,22,0.10)",
    title: "Business Context",
    desc: "Your product goals, KPIs, and terminology — so answers are relevant, not generic.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="px-6 md:px-12 py-24 max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center"
    >
      {/* Left */}
      <div>
        <h2
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 800,
            letterSpacing: "-2px",
            lineHeight: 1.05,
            color: "#0a0a0f",
            marginBottom: 20,
          }}
        >
          Three inputs.
          <br />
          Infinite insights.
        </h2>
        <p style={{ color: "#7c7c8a", fontSize: 17, lineHeight: 1.7, marginBottom: 40, fontFamily: "'DM Sans', sans-serif" }}>
          Magnitude builds a rich understanding of your product by combining your analytics events, your actual codebase, and your business context — then lets you talk to it in plain English.
        </p>

        <div className="flex flex-col gap-6">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm"
                style={{ background: "#4f3bf5", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, marginTop: 2 }}
              >
                {s.num}
              </div>
              <div>
                <h4 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 16, color: "#0a0a0f", marginBottom: 4 }}>
                  {s.title}
                </h4>
                <p style={{ fontSize: 14, color: "#7c7c8a" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — context cards */}
      <div className="flex flex-col gap-4">
        {contextCards.map((card) => (
          <div
            key={card.title}
            className="flex items-start gap-4 p-5 rounded-xl transition-all hover:-translate-y-0.5"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(10,10,15,0.10)",
              boxShadow: "none",
            }}
          >
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
              style={{ background: card.bg }}
            >
              <card.icon className="w-5 h-5" style={{ color: "#0a0a0f" }} />
            </div>
            <div>
              <h4 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 600, color: "#0a0a0f", marginBottom: 4 }}>
                {card.title}
              </h4>
              <p style={{ fontSize: 13, color: "#7c7c8a" }}>{card.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
