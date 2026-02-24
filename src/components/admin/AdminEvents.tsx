import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function AdminEvents() {
  const queryClient = useQueryClient();
  const [searchName, setSearchName] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("timestamp", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["admin-projects-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, user_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-sync"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name, onboarding_data");
      if (error) throw error;
      return data;
    },
  });

  // Users who have analytics keys configured
  const usersWithAnalytics = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((p) => {
      const analytics = (p.onboarding_data as any)?.analytics;
      return analytics?.posthog_personal_key || analytics?.mixpanel_secret || analytics?.ga_property_id;
    });
  }, [profiles]);

  const handleSyncUser = async (targetUserId: string) => {
    setSyncingUserId(targetUserId);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-external-events", {
        body: { target_user_id: targetUserId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Synced ${data.count} events from ${data.source} for user`);
        queryClient.invalidateQueries({ queryKey: ["admin-events-all"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to sync");
    } finally {
      setSyncingUserId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    let totalSynced = 0;
    for (const user of usersWithAnalytics) {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-external-events", {
          body: { target_user_id: user.user_id },
        });
        if (!error && data?.count) totalSynced += data.count;
      } catch {
        // continue with next user
      }
    }
    toast.success(`Synced ${totalSynced} total events across ${usersWithAnalytics.length} users`);
    queryClient.invalidateQueries({ queryKey: ["admin-events-all"] });
    setSyncingAll(false);
  };

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (searchName && !e.event_name.toLowerCase().includes(searchName.toLowerCase())) return false;
      if (filterProject !== "all" && e.project_id !== filterProject) return false;
      if (filterUser !== "all" && e.user_identifier !== filterUser) return false;
      return true;
    });
  }, [events, searchName, filterProject, filterUser]);

  const uniqueUsers = useMemo(() => {
    if (!events) return [];
    const set = new Set<string>();
    events.forEach((e) => { if (e.user_identifier) set.add(e.user_identifier); });
    return Array.from(set).sort();
  }, [events]);

  const uniqueEvents = useMemo(() => {
    const map = new Map<string, { name: string; count: number; lastSeen: string; users: Set<string> }>();
    filteredEvents.forEach((e) => {
      const existing = map.get(e.event_name);
      if (existing) {
        existing.count++;
        if (e.user_identifier) existing.users.add(e.user_identifier);
        if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
      } else {
        const users = new Set<string>();
        if (e.user_identifier) users.add(e.user_identifier);
        map.set(e.event_name, { name: e.event_name, count: 1, lastSeen: e.timestamp, users });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filteredEvents.length} / {events?.length ?? 0} events</Badge>
          {usersWithAnalytics.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleSyncAll} disabled={syncingAll}>
              {syncingAll ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Syncing All...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" /> Sync All Users</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Per-user sync controls */}
      {usersWithAnalytics.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Users with analytics keys configured:</p>
            <div className="flex flex-wrap gap-2">
              {usersWithAnalytics.map((u) => {
                const analytics = (u.onboarding_data as any)?.analytics;
                const provider = analytics?.posthog_personal_key ? "PostHog" : analytics?.mixpanel_secret ? "Mixpanel" : "GA4";
                return (
                  <Button
                    key={u.user_id}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={syncingUserId === u.user_id}
                    onClick={() => handleSyncUser(u.user_id)}
                  >
                    {syncingUserId === u.user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {u.display_name || "User"} ({provider})
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search event name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="w-64"
        />
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {uniqueUsers.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Unique Users</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {uniqueEvents.map((e) => (
                <TableRow key={e.name}>
                  <TableCell className="font-mono font-medium">{e.name}</TableCell>
                  <TableCell>{e.count}</TableCell>
                  <TableCell>{e.users.size}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {new Date(e.lastSeen).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !uniqueEvents.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No events found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
