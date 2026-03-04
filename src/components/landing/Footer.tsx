import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer
      className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 md:px-12 py-10"
      style={{ borderTop: "1px solid rgba(10,10,15,0.10)", fontFamily: "'Mona Sans', sans-serif" }}
    >
      <Link to="/" className="flex items-center gap-2 no-underline" style={{ color: "#0a0a0f" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#4f3bf5" }}>
          <Activity className="w-[18px] h-[18px] text-white" />
        </div>
        <span className="font-bold" style={{ fontSize: 16 }}>Magnitude</span>
      </Link>
      <p style={{ fontSize: 13, color: "#7c7c8a" }}>
        © {new Date().getFullYear()} Magnitude. Formerly Event Context Protocol.
      </p>
    </footer>
  );
}
