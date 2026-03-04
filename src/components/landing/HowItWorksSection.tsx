import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowDown, Sparkles, MessageSquare } from "lucide-react";
import posthogLogo from "@/assets/posthog-logo.png";
import mixpanelLogo from "@/assets/mixpanel-logo.png";
import gaLogo from "@/assets/ga-logo.svg";
import metabaseLogo from "@/assets/metabase-logo.svg";
import supabaseLogo from "@/assets/supabase-logo.png";
import githubLogo from "@/assets/github-logo.png";

const analyticsLogos = [
  { src: posthogLogo, alt: "PostHog" },
  { src: mixpanelLogo, alt: "Mixpanel" },
  { src: gaLogo, alt: "Google Analytics" },
  { src: metabaseLogo, alt: "Metabase" },
  { src: supabaseLogo, alt: "Supabase" },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-24"
      style={{ fontFamily: "'Mona Sans', sans-serif" }}
    >
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <div className="text-center mb-16">
          <h2
            className="font-bold mb-4"
            style={{ fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-1.5px", lineHeight: 1.1, color: "#0a0a0f" }}
          >
            Three inputs.<br />Infinite insights.
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: "#7c7c8a", lineHeight: 1.7 }}>
            Magnitude builds a rich understanding of your product by combining your analytics events, your actual codebase, and your business context — then lets you talk to it in plain English.
          </p>
        </div>

        <div className="space-y-6">
          {/* Step 1 */}
          <Card className="border-border hover:border-primary/40 transition-all duration-300" style={{ background: "#ffffff" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white" style={{ background: "#4f3bf5" }}>1</div>
                  <div>
                    <CardTitle className="text-base" style={{ color: "#0a0a0f" }}>Connect Analytics</CardTitle>
                    <CardDescription className="text-xs">Link your existing analytics platform</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Step 1</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {analyticsLogos.map((logo) => (
                  <div key={logo.alt} className="flex items-center gap-2.5 rounded-lg border border-border p-3 transition-all duration-200 cursor-default" style={{ background: "#ffffff" }}>
                    <img src={logo.src} alt={logo.alt} className="h-6 w-6 object-contain" />
                    <span className="text-sm font-medium" style={{ color: "#0a0a0f" }}>{logo.alt}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 animate-bounce" style={{ color: "#7c7c8a", animationDuration: "2s" }} />
          </div>

          {/* Step 2 */}
          <Card className="border-border hover:border-primary/40 transition-all duration-300" style={{ background: "#ffffff" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white" style={{ background: "#4f3bf5" }}>2</div>
                  <div>
                    <CardTitle className="text-base" style={{ color: "#0a0a0f" }}>Connect Codebase</CardTitle>
                    <CardDescription className="text-xs">Link your GitHub repository for code-aware insights</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Step 2</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="max-w-xs">
                <div className="flex items-center gap-2.5 rounded-lg border border-border p-3 cursor-default" style={{ background: "#ffffff" }}>
                  <img src={githubLogo} alt="GitHub" className="h-6 w-6 object-contain" />
                  <span className="text-sm font-medium" style={{ color: "#0a0a0f" }}>GitHub</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 animate-bounce" style={{ color: "#7c7c8a", animationDuration: "2s", animationDelay: "0.3s" }} />
          </div>

          {/* Step 3 */}
          <Card className="border-border hover:border-primary/40 transition-all duration-300" style={{ background: "#ffffff" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-sm text-white" style={{ background: "#4f3bf5" }}>3</div>
                  <div>
                    <CardTitle className="text-base" style={{ color: "#0a0a0f" }}>Business Context</CardTitle>
                    <CardDescription className="text-xs">Chat with AI to describe your product, audience, and goals</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">Step 3</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-lg border border-border p-3 space-y-2" style={{ background: "rgba(245,243,238,0.5)" }}>
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#4f3bf5" }} />
                  <div className="space-y-1.5 text-xs" style={{ color: "#7c7c8a" }}>
                    <p className="italic">"We're a B2B SaaS for project management. Our users are engineering teams..."</p>
                    <p className="italic">"Our main goal is to increase activation rate for new signups."</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <ArrowDown className="h-5 w-5 animate-bounce" style={{ color: "#7c7c8a", animationDuration: "2s", animationDelay: "0.5s" }} />
          </div>

          {/* Step 4 */}
          <Card className="relative overflow-hidden transition-all duration-300" style={{ background: "#ffffff", border: "1px solid rgba(79,59,245,0.3)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(79,59,245,0.05) 0%, transparent 100%)" }} />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4" style={{ color: "#4f3bf5" }} />
                  </div>
                  <div>
                    <CardTitle className="text-base" style={{ color: "#0a0a0f" }}>Get AI-Powered Insights</CardTitle>
                    <CardDescription className="text-xs">Magnitude analyzes your data and codebase together</CardDescription>
                  </div>
                </div>
                <Badge className="text-xs" style={{ background: "#4f3bf5", color: "white" }}>Final Step</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative">
              <div className="rounded-lg border border-border p-4 space-y-3" style={{ background: "rgba(245,243,238,0.5)" }}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Events", value: "12,847" },
                    { label: "Unique Users", value: "1,293" },
                    { label: "Top Event", value: "page_viewed" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-md border border-border p-2.5" style={{ background: "#ffffff" }}>
                      <p className="text-[10px]" style={{ color: "#7c7c8a" }}>{stat.label}</p>
                      <p className="text-sm font-bold font-mono" style={{ color: "#0a0a0f" }}>{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border p-2.5" style={{ background: "#ffffff" }}>
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#4f3bf5" }} />
                  <p className="text-xs italic" style={{ color: "#7c7c8a" }}>
                    "Your signup_completed rate dropped 12% this week. The codebase shows a new validation step was added on Tuesday."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Done */}
          <div className="flex justify-center pt-4">
            <div className="flex items-center gap-2 text-sm" style={{ color: "#7c7c8a" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(79,59,245,0.15)" }}>
                <Check className="h-3.5 w-3.5" style={{ color: "#4f3bf5" }} />
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
