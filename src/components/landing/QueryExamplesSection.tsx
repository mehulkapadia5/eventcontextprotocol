const queries = [
  "What caused the drop in signups last Tuesday?",
  "Which pages have the highest drop-off rate?",
  "Show me my most active users this week",
  "What's my visitor to signup conversion rate?",
  "Are there users who signed up but never came back?",
  "Which features are most used by power users?",
  "Show traffic sources breakdown for March",
  "Why are events missing for 30 new users?",
];

export function QueryExamplesSection() {
  return (
    <section id="examples" className="px-6 md:px-12 py-24 max-w-[1200px] mx-auto" style={{ fontFamily: "'Mona Sans', sans-serif" }}>
      <h2 className="text-center font-bold mb-3" style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-1.5px", color: "#0a0a0f" }}>
        What can you ask?
      </h2>
      <p className="text-center mb-16" style={{ color: "#7c7c8a", fontSize: 17 }}>
        Real questions from real product teams.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queries.map((q) => (
          <div
            key={q}
            className="flex items-center gap-3 rounded-[10px] px-5 py-4 text-[15px] cursor-default transition-all"
            style={{ background: "#ffffff", border: "1px solid rgba(10,10,15,0.10)", color: "#0a0a0f" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4f3bf5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,59,245,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(10,10,15,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <span style={{ color: "#4f3bf5", fontSize: 18 }}>→</span>
            {q}
          </div>
        ))}
      </div>
    </section>
  );
}
