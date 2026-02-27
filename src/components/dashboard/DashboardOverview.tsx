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
        toast.success(`Synced ${data.count} events from ${data.source}`);
        queryClient.invalidateQueries({ queryKey: ["events-overview"] });
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

  // Aggregate: total events count
  const { data: totalEvents } = useQuery({
    queryKey: ["events-overview-total", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("project_id", projectIds);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Aggregate: unique users
  const { data: uniqueUsers } = useQuery({
    queryKey: ["events-overview-users", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT COUNT(DISTINCT user_identifier) as cnt FROM events WHERE project_id IN (${projectIds.map((id) => `'${id}'`).join(",")}) AND user_identifier IS NOT NULL`,
      });
      if (error) throw error;
      return (data as any)?.[0]?.cnt ?? 0;
    },
  });

  // Aggregate: events today
  const { data: eventsToday } = useQuery({
    queryKey: ["events-overview-today", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("project_id", projectIds)
        .gte("timestamp", todayStart.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Aggregate: top events (grouped count)
  const { data: topEventsData } = useQuery({
    queryKey: ["events-overview-top", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT event_name as name, COUNT(*) as count FROM events WHERE project_id IN (${projectIds.map((id) => `'${id}'`).join(",")}) GROUP BY event_name ORDER BY count DESC LIMIT 10`,
      });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // Aggregate: daily volume last 7 days
  const { data: volumeData } = useQuery({
    queryKey: ["events-overview-volume", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("execute_readonly_query", {
        query_text: `SELECT to_char(timestamp, 'MM-DD') as date, COUNT(*) as count FROM events WHERE project_id IN (${projectIds.map((id) => `'${id}'`).join(",")}) AND timestamp >= now() - interval '7 days' GROUP BY to_char(timestamp, 'MM-DD') ORDER BY date`,
      });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // Recent events for display table only
  const { data: recentEvents } = useQuery({
    queryKey: ["events-overview-recent", projectIds],
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

  const topEvent = topEventsData?.[0]?.name ?? "—";
  const topEventsChart = (topEventsData ?? []).map((e: any) => ({ name: e.name, count: Number(e.count) }));
  const volumeChart = (volumeData ?? []).map((e: any) => ({ date: e.date, count: Number(e.count) }));

  const stats = [
    { label: "Total Events", value: totalEvents ?? 0, icon: Activity },
    { label: "Unique Users", value: uniqueUsers ?? 0, icon: Users },
    { label: "Events Today", value: eventsToday ?? 0, icon: CalendarDays },
    { label: "Top Event", value: topEvent, icon: BarChart3 },
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
        {stats.map((s) => (
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
              <LineChart data={volumeChart}>
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
              <BarChart data={topEventsChart} layout="vertical">
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
