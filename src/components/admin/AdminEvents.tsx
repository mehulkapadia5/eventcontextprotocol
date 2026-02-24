import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export function AdminEvents() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("timestamp", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  const uniqueEvents = useMemo(() => {
    if (!events) return [];
    const map = new Map<string, { name: string; count: number; lastSeen: string; users: Set<string> }>();
    events.forEach((e) => {
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
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Badge variant="secondary">{events?.length ?? 0} total events</Badge>
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
