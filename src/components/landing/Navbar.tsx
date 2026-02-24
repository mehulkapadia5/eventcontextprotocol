import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold font-mono tracking-tight">ECP</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
          <a href="#sdk" className="hover:text-foreground transition-colors">SDK</a>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Log In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth?tab=signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
