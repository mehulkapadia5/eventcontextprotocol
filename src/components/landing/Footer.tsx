import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-mono font-bold">ECP</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Event Collection Platform. Built for developers.
        </p>
      </div>
    </footer>
  );
}
