import { Routes, Route, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, LogOut, MessageSquare, Search, FileText, Shield } from "lucide-react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { EventsExplorer } from "@/components/dashboard/EventsExplorer";
import { ChatPage } from "@/components/dashboard/ChatPage";
import { ContextPage } from "@/components/dashboard/ContextPage";

export default function Dashboard() {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    }`;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border p-4 gap-2 h-screen sticky top-0">
        <div className="flex items-center gap-2 px-3 py-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-mono font-bold text-lg">ECP</span>
        </div>
        <NavLink to="/dashboard" end className={linkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>
        <NavLink to="/dashboard/events" className={linkClass}>
          <Search className="h-4 w-4" />
          Events Explorer
        </NavLink>
        <NavLink to="/dashboard/chat" className={linkClass}>
          <MessageSquare className="h-4 w-4" />
          Chat
        </NavLink>
        <NavLink to="/dashboard/context" className={linkClass}>
          <FileText className="h-4 w-4" />
          Context Memory
        </NavLink>
        <div className="mt-auto space-y-1">
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              <Shield className="h-4 w-4" />
              Admin Panel
            </NavLink>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="events" element={<EventsExplorer />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="context" element={<ContextPage />} />
        </Routes>
      </main>
    </div>
  );
}
