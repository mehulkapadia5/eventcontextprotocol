import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Activity, Users, FolderKanban, Zap, Brain, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminProjects } from "@/components/admin/AdminProjects";
import { AdminEvents } from "@/components/admin/AdminEvents";
import { AdminContexts } from "@/components/admin/AdminContexts";
import { AdminOverview } from "@/components/admin/AdminOverview";

export default function Admin() {
  const { signOut } = useAuth();
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    }`;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border p-4 gap-2">
        <div className="flex items-center gap-2 px-3 py-2 mb-4">
          <Shield className="h-5 w-5 text-destructive" />
          <span className="font-mono font-bold text-lg">Admin</span>
        </div>
        <NavLink to="/admin" end className={linkClass}>
          <LayoutDashboard className="h-4 w-4" />
          Overview
        </NavLink>
        <NavLink to="/admin/users" className={linkClass}>
          <Users className="h-4 w-4" />
          Users
        </NavLink>
        <NavLink to="/admin/projects" className={linkClass}>
          <FolderKanban className="h-4 w-4" />
          Projects
        </NavLink>
        <NavLink to="/admin/events" className={linkClass}>
          <Zap className="h-4 w-4" />
          Events
        </NavLink>
        <NavLink to="/admin/contexts" className={linkClass}>
          <Brain className="h-4 w-4" />
          Business Contexts
        </NavLink>
        <div className="mt-auto space-y-1">
          <NavLink to="/dashboard" className={linkClass}>
            <Activity className="h-4 w-4" />
            Back to Dashboard
          </NavLink>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="contexts" element={<AdminContexts />} />
        </Routes>
      </main>
    </div>
  );
}
