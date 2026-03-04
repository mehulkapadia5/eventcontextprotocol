import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="container flex flex-col items-center text-center gap-8">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Trusted by product teams worldwide</span>
          </div>
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Your AI{" "}
          <span className="text-primary">Product Analyst</span>
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
          Ask questions about your data to Magnitude in plain English.
        </p>

        <Button size="lg" asChild>
          <Link to="/auth?tab=signup">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>

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
