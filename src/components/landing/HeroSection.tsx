import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden min-h-screen px-6 md:px-12 flex items-center"
      style={{ paddingTop: 100, paddingBottom: 60, fontFamily: "'Mona Sans', sans-serif" }}
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

      <div className="relative z-10 max-w-[1300px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left — Text */}
        <div>
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider text-white mb-8 w-fit"
            style={{ background: "#4f3bf5", letterSpacing: "0.05em", animation: "fadeUp 0.6s ease both" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#e8ff47", animation: "pulse 2s infinite" }} />
            AI Product Analyst
          </div>

          <h1
            className="font-bold"
            style={{
              fontSize: "clamp(40px, 5vw, 72px)",
              lineHeight: 1.05,
              letterSpacing: "-2px",
              color: "#0a0a0f",
              animation: "fadeUp 0.7s 0.1s ease both",
            }}
          >
            Ask your data.
            <br />
            Get <em className="not-italic" style={{ color: "#4f3bf5" }}>real answers.</em>
          </h1>

          <p
            className="mt-6"
            style={{
              fontSize: 17,
              color: "#7c7c8a",
              maxWidth: 480,
              lineHeight: 1.65,
              fontWeight: 400,
              animation: "fadeUp 0.7s 0.2s ease both",
            }}
          >
            Magnitude connects your events, codebase, and business context — so you can query analytics in plain English. No SQL. No dashboards. Just answers.
          </p>

          <div
            className="flex items-center gap-4 mt-10"
            style={{ animation: "fadeUp 0.7s 0.3s ease both" }}
          >
            <Link
              to="/auth?tab=signup"
              className="no-underline text-white font-medium rounded-lg px-8 py-3.5 transition-transform hover:-translate-y-0.5"
              style={{ background: "#4f3bf5", fontSize: 16, boxShadow: "0 4px 20px rgba(79,59,245,0.35)" }}
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
        </div>

        {/* Right — Chat Preview */}
        <div style={{ animation: "fadeUp 0.9s 0.3s ease both" }}>
          <div
            className="overflow-hidden w-full"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(10,10,15,0.10)",
              borderRadius: 16,
              boxShadow: "0 24px 80px rgba(10,10,15,0.10)",
            }}
          >
            <div className="flex items-center gap-3 px-5 py-3" style={{ background: "#0a0a0f" }}>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
                ))}
              </div>
              <span className="font-mono text-[11px] ml-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                magnitude / analytics assistant
              </span>
            </div>
            <div className="flex flex-col gap-3 p-5 text-[13px]">
              <div className="self-end rounded-xl px-3.5 py-3 text-white max-w-[85%]" style={{ background: "#4f3bf5", borderBottomRightRadius: 3 }}>
                What caused the drop in signups last week?
              </div>
              <div className="self-start rounded-xl px-3.5 py-3 max-w-[85%]" style={{ background: "#f4f4f8", color: "#0a0a0f", borderBottomLeftRadius: 3, lineHeight: 1.55 }}>
                Found it. There was a <code className="font-mono text-[11px] px-1 py-0.5 rounded" style={{ background: "rgba(79,59,245,0.08)", color: "#4f3bf5" }}>deployment_change</code> on Feb 27 that removed the tracking code — so <code className="font-mono text-[11px] px-1 py-0.5 rounded" style={{ background: "rgba(79,59,245,0.08)", color: "#4f3bf5" }}>user_signed_in</code> events stopped firing.
              </div>
              <div className="self-end rounded-xl px-3.5 py-3 text-white max-w-[85%]" style={{ background: "#4f3bf5", borderBottomRightRadius: 3 }}>
                Show me top traffic sources this month
              </div>
              <div className="self-start rounded-xl px-3.5 py-3 max-w-[85%]" style={{ background: "#f4f4f8", color: "#0a0a0f", borderBottomLeftRadius: 3, lineHeight: 1.55 }}>
                Top sources (March 1–5): <strong>Direct 38%</strong> · Organic Search 29% · Referral 18% · Social 15%.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
