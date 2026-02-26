import { MessageCircle } from "lucide-react";

export function SupportBubble() {
  return (
    <a
      href="https://wa.me/918660280422"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
      aria-label="Need help? Contact Mehul"
    >
      <MessageCircle className="h-5 w-5" />
      <span>Need help? Contact Mehul</span>
    </a>
  );
}

