import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageSquareText, Plug, Brain, Shield, Sparkles } from "lucide-react";

const features = [
  {
    icon: Clock,
    title: "Setup in 5 Minutes",
    description: "Connect your analytics tools and codebase — no engineering work required to get started.",
  },
  {
    icon: MessageSquareText,
    title: "Ask in Plain English",
    description: "Ask product questions naturally and get AI-powered answers backed by your real data.",
  },
  {
    icon: Plug,
    title: "Works With Your Tools",
    description: "Integrates with Mixpanel, PostHog, Google Analytics, and more. No migration needed.",
  },
  {
    icon: Brain,
    title: "Context-Aware Analysis",
    description: "Connects code changes to metric shifts so you understand the why behind every number.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Per-project data isolation, enterprise-grade encryption, and hosting in US & EU regions.",
  },
  {
    icon: Sparkles,
    title: "No SQL Required",
    description: "Built for product managers and founders — get deep insights without writing a single query.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Built for product teams, not data engineers
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to understand your users — without the complexity.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-card border-border">
              <CardHeader>
                <feature.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
