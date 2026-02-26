import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowDown, Sparkles } from "lucide-react";
import posthogLogo from "@/assets/posthog-logo.png";
import mixpanelLogo from "@/assets/mixpanel-logo.png";
import gaLogo from "@/assets/ga-logo.svg";
import metabaseLogo from "@/assets/metabase-logo.svg";
import githubLogo from "@/assets/github-logo.png";

const analyticsLogos = [
  { src: posthogLogo, alt: "PostHog" },
  { src: mixpanelLogo, alt: "Mixpanel" },
  { src: gaLogo, alt: "Google Analytics" },
  { src: metabaseLogo, alt: "Metabase" },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">3 simple steps</Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Set up in under 5 minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Connect your tools and let ECP do the rest.
          </p>
        </div>

        {/* Steps flow */}
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Step 1 — Connect Analytics */}
          <div className="animate-fade-in" style={{ animationDelay: "0.1s", animationFillMode: "both" }}>
            <Card className="border-border hover:border-primary/40 transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center font-mono font-bold text-sm text-primary">
                      1
                    </div>
                    <div>
                      <CardTitle className="text-base">Connect Analytics</CardTitle>
                      <CardDescription className="text-xs">Link your existing analytics platform</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Step 1</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {analyticsLogos.map((logo) => (
                    <div
                      key={logo.alt}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 hover:border-primary/30 hover:bg-accent/50 transition-all duration-200 cursor-default"
                    >
                      <img src={logo.src} alt={logo.alt} className="h-6 w-6 object-contain" />
                      <span className="text-sm font-medium">{logo.alt}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-1 text-muted-foreground animate-fade-in" style={{ animationDelay: "0.25s", animationFillMode: "both" }}>
              <ArrowDown className="h-5 w-5 animate-bounce" style={{ animationDuration: "2s" }} />
            </div>
          </div>

          {/* Step 2 — Connect Codebase */}
          <div className="animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
            <Card className="border-border hover:border-primary/40 transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center font-mono font-bold text-sm text-primary">
                      2
                    </div>
                    <div>
                      <CardTitle className="text-base">Connect Codebase</CardTitle>
                      <CardDescription className="text-xs">Link your GitHub repository for code-aware insights</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">Step 2</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-w-xs">
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 hover:border-primary/30 hover:bg-accent/50 transition-all duration-200 cursor-default">
                    <img src={githubLogo} alt="GitHub" className="h-6 w-6 object-contain" />
                    <span className="text-sm font-medium">GitHub</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-1 text-muted-foreground animate-fade-in" style={{ animationDelay: "0.45s", animationFillMode: "both" }}>
              <ArrowDown className="h-5 w-5 animate-bounce" style={{ animationDuration: "2s", animationDelay: "0.3s" }} />
            </div>
          </div>

          {/* Step 3 — AI Insights */}
          <div className="animate-fade-in" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
            <Card className="border-primary/40 hover:border-primary/60 transition-all duration-300 relative overflow-hidden">
              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <CardHeader className="pb-3 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Get AI-Powered Insights</CardTitle>
                      <CardDescription className="text-xs">ECP analyzes your data and codebase together</CardDescription>
                    </div>
                  </div>
                  <Badge className="text-xs">Final Step</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 relative">
                {/* Simulated dashboard preview */}
                <div className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Events", value: "12,847" },
                      { label: "Unique Users", value: "1,293" },
                      { label: "Top Event", value: "page_viewed" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-md border border-border bg-background/60 p-2.5">
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        <p className="text-sm font-bold font-mono">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 p-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground italic">
                      "Your signup_completed rate dropped 12% this week. The codebase shows a new validation step was added on Tuesday — that's likely the cause."
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {["signup_completed", "page_viewed", "button_clicked"].map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] font-mono">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Completion indicator */}
          <div className="flex justify-center pt-4 animate-fade-in" style={{ animationDelay: "0.7s", animationFillMode: "both" }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>
              <span>You're all set — insights start flowing immediately</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
