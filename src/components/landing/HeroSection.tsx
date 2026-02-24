import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="container flex flex-col items-center text-center gap-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <Zap className="h-3.5 w-3.5" />
          <span>Developer-first event analytics</span>
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Understand your users with{" "}
          <span className="text-primary">simple event tracking</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Drop in a lightweight SDK, collect events in real-time, and visualize
          everything in a clean dashboard. No bloated analytics suites — just the
          data you need.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" asChild>
            <Link to="/auth?tab=signup">
              Start Tracking Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="#sdk">View SDK</a>
          </Button>
        </div>

        {/* Hero code preview */}
        <div className="mt-8 w-full max-w-2xl rounded-lg border border-border bg-card p-6 text-left font-mono text-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-destructive/60" />
            <div className="h-3 w-3 rounded-full bg-muted" />
            <div className="h-3 w-3 rounded-full bg-muted" />
            <span className="ml-2 text-xs text-muted-foreground">app.js</span>
          </div>
          <pre className="text-muted-foreground overflow-x-auto">
            <code>
{`import { ECP } from '@ecp/sdk';

const tracker = new ECP('your-api-key');

// Track anything
tracker.track('button_clicked', {
  page: '/pricing',
  variant: 'annual'
});`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
