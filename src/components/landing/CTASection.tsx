import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container flex flex-col items-center text-center gap-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Ready to let AI analyze your product data?
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl">
          Get started for free. No credit card required.
        </p>
        <Button size="lg" asChild>
          <Link to="/auth?tab=signup">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
