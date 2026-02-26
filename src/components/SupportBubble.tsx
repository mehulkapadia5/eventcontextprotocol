import { MessageCircle } from "lucide-react";
import { useState } from "react";

export function SupportBubble() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <a
          href="https://wa.me/918660280422"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          Need help? <span className="font-semibold text-primary">Contact Mehul</span>
        </a>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Support"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    </div>
  );
}
