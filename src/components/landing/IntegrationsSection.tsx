import { BarChart3, Activity, TrendingUp, Database, Github, PieChart } from "lucide-react";

const integrations = [
  { icon: BarChart3, label: "PostHog" },
  { icon: Activity, label: "Mixpanel" },
  { icon: TrendingUp, label: "GA4" },
  { icon: PieChart, label: "Metabase" },
  { icon: Database, label: "Supabase" },
  { icon: Github, label: "GitHub" },
];

export function IntegrationsSection() {
  return (
    <section className="px-6 md:px-12 py-16 text-center" style={{ borderTop: "1px solid rgba(10,10,15,0.10)" }}>
      <p className="text-xs uppercase tracking-widest mb-7" style={{ color: "#7c7c8a", letterSpacing: "0.1em" }}>
        Connects with your stack
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {integrations.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all cursor-default"
            style={{
              color: "#7c7c8a",
              border: "1px solid rgba(10,10,15,0.10)",
            }}
          >
            <item.icon className="w-[18px] h-[18px] opacity-60" />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}
