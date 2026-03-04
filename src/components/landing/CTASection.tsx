import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section
      className="relative overflow-hidden px-6 md:px-12 py-28 text-center"
      style={{ background: "#ffffff", borderTop: "1px solid rgba(10,10,15,0.10)", fontFamily: "'Mona Sans', sans-serif" }}
    >
      <div className="absolute pointer-events-none" style={{ width: 600, height: 600, background: "radial-gradient(circle, rgba(79,59,245,0.12) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
      <h2 className="relative font-bold" style={{ fontSize: "clamp(36px, 5vw, 64px)", letterSpacing: "-2px", marginBottom: 20, color: "#0a0a0f" }}>
        Your AI product analyst.<br />Always on.
      </h2>
      <p className="relative mb-10" style={{ color: "#7c7c8a", fontSize: 18 }}>
        Connect your events in minutes. Start asking questions today.
      </p>
      <Link
        to="/auth?tab=signup"
        className="relative inline-block no-underline text-white font-medium rounded-lg px-10 py-4 transition-transform hover:-translate-y-0.5"
        style={{ background: "#4f3bf5", fontSize: 17, boxShadow: "0 4px 20px rgba(79,59,245,0.35)" }}
      >
        Get started for free →
      </Link>
    </section>
  );
}
