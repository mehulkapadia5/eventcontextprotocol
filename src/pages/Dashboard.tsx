import { useState, useEffect } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, FolderOpen, LayoutDashboard, LogOut, Search } from "lucide-react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { EventsExplorer } from "@/components/dashboard/EventsExplorer";
import { ProjectsPage } from "@/components/dashboard/ProjectsPage";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function Dashboard() {
  const { session, signOut } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => {
        setOnboardingCompleted((data as any)?.onboarding_completed ?? false);
      });
  }, [session?.user?.id]);

  if (onboardingCompleted === null) {
    return <div className="min-h-screen bg-background" />;
  }

  if (onboardingCompleted === false && session?.user?.id) {
    return (
      <OnboardingWizard
        userId={session.user.id}
        onComplete={() => setOnboardingCompleted(true)}
      />
    );
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    }`;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border p-4 gap-2">
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
        <NavLink to="/dashboard/projects" className={linkClass}>
          <FolderOpen className="h-4 w-4" />
          Projects
        </NavLink>
        <div className="mt-auto">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <Routes>
          <Route index element={<DashboardOverview />} />
          <Route path="events" element={<EventsExplorer />} />
          <Route path="projects" element={<ProjectsPage />} />
        </Routes>
      </main>
    </div>
  );
}
