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

  const navItems = [
    { to: "/dashboard", end: true, icon: MessageSquare, label: "Chat" },
    { to: "/dashboard/overview", icon: LayoutDashboard, label: "Overview" },
    { to: "/dashboard/events", icon: Search, label: "Events Explorer" },
    { to: "/dashboard/context", icon: FileText, label: "Context Memory" },
    { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border h-screen sticky top-0 transition-all duration-200",
          sidebarOpen ? "w-64 p-4" : "w-14 p-2 items-center"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center mb-4",
            sidebarOpen ? "gap-2 px-3 py-2 justify-between" : "justify-center py-2"
          )}
        >
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary shrink-0" />
              <span className="font-mono font-bold text-lg">ECP</span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav items */}
        <div className={cn("flex flex-col gap-1", !sidebarOpen && "items-center")}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={!sidebarOpen ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-md transition-colors",
                  sidebarOpen ? "gap-2 px-3 py-2 text-sm" : "justify-center p-2",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && item.label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className={cn("mt-auto flex flex-col gap-1", !sidebarOpen && "items-center")}>
          {isAdmin && (
            <NavLink
              to="/admin"
              title={!sidebarOpen ? "Admin Panel" : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-md transition-colors",
                  sidebarOpen ? "gap-2 px-3 py-2 text-sm" : "justify-center p-2",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              <Shield className="h-4 w-4 shrink-0" />
              {sidebarOpen && "Admin Panel"}
            </NavLink>
          )}
          <Button
            variant="ghost"
            size={sidebarOpen ? "sm" : "icon"}
            className={cn(
              "text-muted-foreground",
              sidebarOpen ? "w-full justify-start" : "h-8 w-8"
            )}
            title={!sidebarOpen ? "Sign Out" : undefined}
            onClick={signOut}
          >
            <LogOut className={cn("h-4 w-4 shrink-0", sidebarOpen && "mr-2")} />
            {sidebarOpen && "Sign Out"}
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto relative">
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
