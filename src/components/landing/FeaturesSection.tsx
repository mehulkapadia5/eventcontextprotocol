import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Code2, Gauge, Shield, Webhook, Zap } from "lucide-react";

const features = [
  {
    icon: Code2,
    title: "Lightweight SDK",
    description: "Under 5KB. One line to install, one function to track. No bloat, no dependencies.",
  },
  {
    icon: Gauge,
    title: "Real-Time Dashboard",
    description: "See events as they happen. Live counters, charts, and feeds that update instantly.",
  },
  {
    icon: BarChart3,
    title: "Visual Analytics",
    description: "Beautiful charts showing event volume, top actions, and user trends over time.",
  },
  {
    icon: Webhook,
    title: "Event Ingestion API",
    description: "RESTful endpoint that accepts events from any platform — web, mobile, or server.",
  },
  {
    icon: Shield,
    title: "Per-Project Isolation",
    description: "Create separate projects with unique API keys. Each project's data is fully isolated.",
  },
  {
    icon: Zap,
    title: "AI-Ready Data",
    description: "Structured event data that's perfect for feeding into AI models and automations.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl mb-4">
            Everything you need to track events
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete analytics toolkit designed for developers who want clarity without complexity.
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
