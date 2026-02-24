import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";

export function AdminEvents() {
  const [searchName, setSearchName] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");

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
      const { data, error } = await supabase.from("projects").select("id, name");
      if (error) throw error;
      return data;
    },
  });

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
        <Badge variant="secondary">{filteredEvents.length} / {events?.length ?? 0} events</Badge>
      </div>

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
