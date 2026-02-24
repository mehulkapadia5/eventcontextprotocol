import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, Search } from "lucide-react";

export function EventsExplorer() {
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const projectIds = projects?.map((p) => p.id) ?? [];

  const { data: events } = useQuery({
    queryKey: ["events-explorer", projectIds, search],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*")
        .in("project_id", projectIds)
        .order("timestamp", { ascending: false })
        .limit(500);

      if (search) {
        query = query.ilike("event_name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const allEvents = events ?? [];

  const exportCSV = () => {
    if (allEvents.length === 0) return;
    const headers = ["event_name", "user_identifier", "page_url", "timestamp", "properties"];
    const rows = allEvents.map((e) => [
      e.event_name,
      e.user_identifier ?? "",
      e.page_url ?? "",
      e.timestamp,
      JSON.stringify(e.properties),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "events.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events Explorer</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by event name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Page URL</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEvents.map((event) => (
                <TableRow
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedEvent(event)}
                >
                  <TableCell className="font-mono font-medium">{event.event_name}</TableCell>
                  <TableCell className="text-muted-foreground">{event.user_identifier ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{event.page_url ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {allEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No events found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="font-mono">{selectedEvent?.event_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 text-sm">
            <div>
              <span className="text-muted-foreground">Timestamp</span>
              <p className="font-mono">{selectedEvent && new Date(selectedEvent.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">User</span>
              <p className="font-mono">{selectedEvent?.user_identifier ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Page URL</span>
              <p className="font-mono break-all">{selectedEvent?.page_url ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Properties</span>
              <pre className="mt-1 rounded border border-border bg-card p-3 font-mono text-xs overflow-auto max-h-64">
                {JSON.stringify(selectedEvent?.properties, null, 2)}
              </pre>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
