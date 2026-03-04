import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export function Navbar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 border-b"
      style={{
        background: "rgba(245,243,238,0.85)",
        backdropFilter: "blur(12px)",
        borderColor: "rgba(10,10,15,0.10)",
      }}
    >
      <Link to="/" className="flex items-center gap-2.5 no-underline" style={{ color: "#0a0a0f" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "#4f3bf5" }}
        >
          <Activity className="w-[18px] h-[18px] text-white" />
        </div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px" }}>
          Magnitude
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-9">
        <a href="#how-it-works" className="text-sm no-underline transition-colors" style={{ color: "#7c7c8a" }}>
          How it works
        </a>
        <a href="#features" className="text-sm no-underline transition-colors" style={{ color: "#7c7c8a" }}>
          Features
        </a>
        <a href="#examples" className="text-sm no-underline transition-colors" style={{ color: "#7c7c8a" }}>
          Examples
        </a>
      </nav>

      <Link
        to="/auth?tab=signup"
        className="text-sm font-medium no-underline rounded-md px-5 py-2.5 transition-opacity"
        style={{ background: "#0a0a0f", color: "#f5f3ee" }}
      >
        Get Started →
      </Link>
    </header>
  );
}
