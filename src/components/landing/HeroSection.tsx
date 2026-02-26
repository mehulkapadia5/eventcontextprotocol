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
          Connect your analytics tools, link your codebase, and let ECP give you
          AI-powered insights — all in under 5 minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" asChild>
            <Link to="/auth?tab=signup">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a href="#how-it-works">See How It Works</a>
          </Button>
        </div>

        {/* Demo video */}
        <div className="mt-8 w-full max-w-3xl rounded-lg border border-border overflow-hidden shadow-lg">
          <video
            className="w-full"
            controls
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/demo-video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </section>
  );
}
