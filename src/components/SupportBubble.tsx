import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export function SupportBubble() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="mb-1 rounded-xl border border-border bg-card p-4 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 w-56">
          <p className="text-sm font-medium mb-3">Need help?</p>
          <a
            href="https://wa.me/918660280422"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Talk to Mehul →
          </a>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105"
        aria-label="Support"
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
      </button>
    </div>
  );
}
