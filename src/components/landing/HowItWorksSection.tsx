import posthogLogo from "@/assets/posthog-logo.png";
import mixpanelLogo from "@/assets/mixpanel-logo.png";
import gaLogo from "@/assets/ga-logo.svg";
import metabaseLogo from "@/assets/metabase-logo.svg";
import githubLogo from "@/assets/github-logo.png";

const steps = [
  {
    number: "01",
    title: "Connect Analytics",
    description:
      "Link your existing analytics platform — PostHog, Mixpanel, Google Analytics, or Metabase — and import your event data.",
    logos: [
      { src: posthogLogo, alt: "PostHog" },
      { src: mixpanelLogo, alt: "Mixpanel" },
      { src: gaLogo, alt: "Google Analytics" },
      { src: metabaseLogo, alt: "Metabase" },
    ],
  },
  {
    number: "02",
    title: "Connect Codebase",
    description:
      "Link your GitHub repository so ECP can provide code-aware context and insights.",
    logos: [{ src: githubLogo, alt: "GitHub" }],
  },
  {
    number: "03",
    title: "Get AI-Powered Insights",
    description:
      "Describe your product and goals. ECP combines your analytics data and codebase to deliver actionable insights.",
    logos: [],
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            3 steps to get started
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your tools and let ECP do the rest.
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-3 max-w-5xl mx-auto">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col gap-4 items-center text-center">
              <span className="font-mono text-4xl font-bold text-primary">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {step.description}
              </p>
              {step.logos.length > 0 && (
                <div className="flex items-center gap-4 mt-2">
                  {step.logos.map((logo) => (
                    <img
                      key={logo.alt}
                      src={logo.src}
                      alt={logo.alt}
                      className="h-8 w-8 object-contain"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
