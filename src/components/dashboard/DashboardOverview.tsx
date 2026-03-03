import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, BarChart3, CalendarDays, Loader2, RefreshCw, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { OnboardingCards } from "@/components/onboarding/OnboardingCards";
import { toast } from "sonner";
export function DashboardOverview() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const analyticsData = (profile?.onboarding_data as any)?.analytics;
  const hasReadKeys = !!(analyticsData?.posthog_personal_key || analyticsData?.mixpanel_secret);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-external-events");
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        const msg = data.duplicates_skipped
          ? `Synced ${data.count} new events from ${data.source} (${data.duplicates_skipped} duplicates skipped)`
          : `Synced ${data.count} events from ${data.source}`;
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        queryClient.invalidateQueries({ queryKey: ["top-events-chart"] });
        queryClient.invalidateQueries({ queryKey: ["event-volume-chart"] });
        queryClient.invalidateQueries({ queryKey: ["recent-events"] });
        queryClient.invalidateQueries({ queryKey: ["events-explorer"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync events");
    } finally {
      setSyncing(false);
    }
  };

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const projectIds = projects?.map((p) => p.id) ?? [];

  // Server-side aggregation: dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_project_ids: projectIds,
      });
      if (error) throw error;
      return data as {
        total_events: number;
        unique_users: number;
        events_today: number;
        top_event_name: string | null;
        top_event_count: number;
      };
    },
  });

  // Server-side aggregation: top events chart
  const { data: topEventsChart } = useQuery({
    queryKey: ["top-events-chart", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_events", {
        p_project_ids: projectIds,
        p_limit: 10,
      });
      if (error) throw error;
      return (data as { name: string; count: number; unique_users: number }[]) ?? [];
    },
  });

  // Server-side aggregation: event volume over 7 days
  const { data: volumeChart } = useQuery({
    queryKey: ["event-volume-chart", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_volume", {
        p_project_ids: projectIds,
        p_days: 7,
      });
      if (error) throw error;
      return ((data as { date: string; count: number }[]) ?? []).map((d) => ({
        date: d.date.slice(5),
        count: d.count,
      }));
    },
  });

  // Recent events - small query, just 20 for the list
  const { data: recentEvents } = useQuery({
    queryKey: ["recent-events", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, event_name, user_identifier, timestamp")
        .in("project_id", projectIds)
        .order("timestamp", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const statCards = [
    { label: "Total Events", value: stats?.total_events?.toLocaleString() ?? "0", icon: Activity },
    { label: "Unique Users", value: stats?.unique_users?.toLocaleString() ?? "0", icon: Users },
    { label: "Events Today", value: stats?.events_today?.toLocaleString() ?? "0", icon: CalendarDays },
    { label: "Top Event", value: stats?.top_event_name ?? "—", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {hasReadKeys && (
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Syncing...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" /> Sync Events</>
            )}
          </Button>
        )}
      </div>

      <OnboardingCards />

      {projectIds.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No projects yet. Create your first project to start tracking events.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono truncate">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Volume (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeChart ?? []}>
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Events</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topEventsChart ?? []} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-auto">
            {(recentEvents ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium">{event.event_name}</span>
                  {event.user_identifier && (
                    <span className="text-muted-foreground text-xs">{event.user_identifier}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {(!recentEvents || recentEvents.length === 0) && (
              <p className="text-center text-muted-foreground py-4">No events yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
