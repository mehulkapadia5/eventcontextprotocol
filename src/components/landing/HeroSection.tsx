import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden flex flex-col justify-center min-h-screen px-6 md:px-12"
      style={{ paddingTop: 140, paddingBottom: 80 }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(10,10,15,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,15,0.10) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 80%)",
        }}
      />

      {/* Badge */}
      <div
        className="relative z-10 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider text-white mb-8 w-fit"
        style={{ background: "#4f3bf5", letterSpacing: "0.05em", animation: "fadeUp 0.6s ease both" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#e8ff47", animation: "pulse 2s infinite" }} />
        AI Product Analyst
      </div>

      {/* Heading */}
      <h1
        className="relative z-10"
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "clamp(52px, 7vw, 96px)",
          fontWeight: 800,
          lineHeight: 1.0,
          letterSpacing: "-3px",
          maxWidth: 900,
          animation: "fadeUp 0.7s 0.1s ease both",
          color: "#0a0a0f",
        }}
      >
        Ask your data.
        <br />
        Get <em className="not-italic" style={{ color: "#4f3bf5" }}>real answers.</em>
      </h1>

      {/* Subtitle */}
      <p
        className="relative z-10 mt-7"
        style={{
          fontSize: 19,
          color: "#7c7c8a",
          maxWidth: 520,
          lineHeight: 1.65,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 300,
          animation: "fadeUp 0.7s 0.2s ease both",
        }}
      >
        Magnitude connects your events, codebase, and business context — so you can query analytics in plain English. No SQL. No dashboards. Just answers.
      </p>

      {/* Actions */}
      <div
        className="relative z-10 flex items-center gap-4 mt-11"
        style={{ animation: "fadeUp 0.7s 0.3s ease both" }}
      >
        <Link
          to="/auth?tab=signup"
          className="no-underline text-white font-medium rounded-lg px-8 py-3.5 transition-transform hover:-translate-y-0.5"
          style={{
            background: "#4f3bf5",
            fontSize: 16,
            boxShadow: "0 4px 20px rgba(79,59,245,0.35)",
          }}
        >
          Start for free
        </Link>
        <a
          href="#how-it-works"
          className="flex items-center gap-2 no-underline text-sm opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: "#0a0a0f" }}
        >
          See how it works
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      {/* Chat Preview */}
      <div
        className="relative z-10 mt-20"
        style={{ animation: "fadeUp 0.9s 0.4s ease both" }}
      >
        <div
          className="overflow-hidden"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(10,10,15,0.10)",
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(10,10,15,0.10)",
            maxWidth: 820,
          }}
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: "#0a0a0f" }}>
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              <span className="w-3 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            </div>
            <span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", fontSize: 12, marginLeft: 8 }}>
              magnitude / analytics assistant
            </span>
          </div>

          {/* Chat body */}
          <div className="flex flex-col gap-4 p-7">
            <div className="self-end rounded-xl px-4 py-3.5 text-sm text-white max-w-[85%]" style={{ background: "#4f3bf5", borderBottomRightRadius: 3 }}>
              What caused the drop in signups last week?
            </div>
            <div className="self-start rounded-xl px-4 py-3.5 text-sm max-w-[85%]" style={{ background: "#f4f4f8", color: "#0a0a0f", borderBottomLeftRadius: 3 }}>
              Found it. There was a <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, background: "rgba(79,59,245,0.08)", color: "#4f3bf5", padding: "2px 6px", borderRadius: 4 }}>deployment_change</code> on Feb 27 that removed the tracking code — so <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, background: "rgba(79,59,245,0.08)", color: "#4f3bf5", padding: "2px 6px", borderRadius: 4 }}>user_signed_in</code> events stopped firing. Your actual signups likely didn't drop; they just went untracked.
            </div>
            <div className="self-end rounded-xl px-4 py-3.5 text-sm text-white max-w-[85%]" style={{ background: "#4f3bf5", borderBottomRightRadius: 3 }}>
              Yes, and also show me my top traffic sources this month
            </div>
            <div className="self-start rounded-xl px-4 py-3.5 text-sm max-w-[85%]" style={{ background: "#f4f4f8", color: "#0a0a0f", borderBottomLeftRadius: 3 }}>
              Top sources (March 1–5): <strong>Direct 38%</strong> · Organic Search 29% · Referral 18% · Social 15%. Direct traffic is unusually high — likely a Product Hunt spike on March 2nd.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
