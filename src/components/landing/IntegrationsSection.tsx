import posthogLogo from "@/assets/posthog-logo.png";
import mixpanelLogo from "@/assets/mixpanel-logo.png";
import gaLogo from "@/assets/ga-logo.svg";
import metabaseLogo from "@/assets/metabase-logo.svg";
import supabaseLogo from "@/assets/supabase-logo.png";
import githubLogo from "@/assets/github-logo.png";

const integrations = [
  { logo: posthogLogo, label: "PostHog" },
  { logo: mixpanelLogo, label: "Mixpanel" },
  { logo: gaLogo, label: "GA4" },
  { logo: metabaseLogo, label: "Metabase" },
  { logo: supabaseLogo, label: "Supabase" },
  { logo: githubLogo, label: "GitHub" },
];

export function IntegrationsSection() {
  return (
    <section
      className="px-6 md:px-12 py-16 text-center"
      style={{ borderTop: "1px solid rgba(10,10,15,0.10)", fontFamily: "'Mona Sans', sans-serif" }}
    >
      <p className="text-xs uppercase tracking-widest mb-7" style={{ color: "#7c7c8a", letterSpacing: "0.1em" }}>
        Connects with your stack
      </p>
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {integrations.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all cursor-default"
            style={{ color: "#7c7c8a", border: "1px solid rgba(10,10,15,0.10)" }}
          >
            <img src={item.logo} alt={item.label} className="w-[18px] h-[18px] object-contain" />
            {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}
