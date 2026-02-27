import { useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Activity, LayoutDashboard, LogOut, MessageSquare, Search, FileText, Shield, Settings, PanelLeftClose, PanelLeft } from "lucide-react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { EventsExplorer } from "@/components/dashboard/EventsExplorer";
import { ChatPage } from "@/components/dashboard/ChatPage";
import { ContextPage } from "@/components/dashboard/ContextPage";
import { SettingsPage } from "@/components/dashboard/SettingsPage";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const isChatPage = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    }`;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border p-4 gap-2 h-screen sticky top-0 transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden p-0"
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2 mb-4 justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-mono font-bold text-lg">ECP</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <NavLink to="/dashboard" end className={linkClass}>
          <MessageSquare className="h-4 w-4" />
          Chat
        </NavLink>
        <NavLink to="/dashboard/overview" className={linkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>
        <NavLink to="/dashboard/events" className={linkClass}>
          <Search className="h-4 w-4" />
          Events Explorer
        </NavLink>
        <NavLink to="/dashboard/context" className={linkClass}>
          <FileText className="h-4 w-4" />
          Context Memory
        </NavLink>
        <NavLink to="/dashboard/settings" className={linkClass}>
          <Settings className="h-4 w-4" />
          Settings
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

      <main className="flex-1 p-6 md:p-8 overflow-auto relative">
        {!sidebarOpen && !isChatPage && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 h-8 w-8 z-10"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        <Routes>
          <Route index element={<ChatPage />} />
          <Route path="overview" element={<DashboardOverview />} />
          <Route path="events" element={<EventsExplorer />} />
          <Route path="context" element={<ContextPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
