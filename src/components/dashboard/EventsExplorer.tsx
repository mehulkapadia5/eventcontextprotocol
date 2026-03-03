import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, Search, ChevronRight, ChevronLeft, User, Clock, Tag, List, BarChart3, ArrowUpDown, FolderKanban, BookOpen, Activity } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDictionary } from "./EventDictionary";

type EventRow = {
  id: string;
  event_name: string;
  user_identifier: string | null;
  page_url: string | null;
  timestamp: string;
  properties: Record<string, any> | null;
  project_id: string;
};

type UniqueEvent = {
  name: string;
  count: number;
  last_seen: string;
  unique_users: number;
};

type PropertySchema = {
  key: string;
  type: string;
  occurrence_count: number;
  sample_values: string[];
};

const PAGE_SIZE = 50;
const INSTANCE_PAGE_SIZE = 50;

function PropertySchemaView({ schema, loading }: { schema: PropertySchema[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading property schema...</p>;

  const userProps = schema.filter((p) => !p.key.startsWith("$"));
  const systemProps = schema.filter((p) => p.key.startsWith("$"));

  const renderSchemaGroup = (items: PropertySchema[], label: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2">{label}</p>
        <div className="space-y-0.5">
          {items.map((prop) => (
            <div key={prop.key} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/50">
              <span className="text-xs font-mono text-muted-foreground shrink-0 min-w-[140px] truncate" title={prop.key}>
                {prop.key.replace(/^\$/, "")}
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">{prop.type}</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {prop.occurrence_count} events
                  </span>
                </div>
                {prop.sample_values.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prop.sample_values.slice(0, 3).map((v, i) => (
                      <span key={i} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[150px]">
                        {v}
                      </span>
                    ))}
                    {prop.sample_values.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{prop.sample_values.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderSchemaGroup(userProps, "Custom Properties")}
      {userProps.length > 0 && systemProps.length > 0 && <Separator />}
      {renderSchemaGroup(systemProps, "System Properties")}
      {schema.length === 0 && <p className="text-sm text-muted-foreground italic py-4">No properties recorded</p>}
    </div>
  );
}

function PropertyValue({ value }: { value: any }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground italic">null</span>;
  if (typeof value === "boolean") return <Badge variant={value ? "default" : "secondary"}>{value ? "true" : "false"}</Badge>;
  if (typeof value === "number") return <span className="font-mono text-primary">{value.toLocaleString()}</span>;
  if (typeof value === "string") {
    if (value.startsWith("http")) return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs break-all">{value}</a>;
    if (value.length > 100) return <span className="text-xs break-all">{value.slice(0, 100)}…</span>;
    return <span className="text-sm">{value}</span>;
  }
  if (Array.isArray(value)) return <Badge variant="outline" className="font-mono text-xs">[{value.length} items]</Badge>;
  if (typeof value === "object") return <Badge variant="outline" className="font-mono text-xs">{`{${Object.keys(value).length} keys}`}</Badge>;
  return <span>{String(value)}</span>;
}

export function EventsExplorer() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EventRow | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "name" | "lastSeen">("count");
  const [view, setView] = useState<"schema" | "instances">("schema");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [instancePage, setInstancePage] = useState(0);

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    // Simple debounce
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timer);
  }, []);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const projectIds = selectedProjectId === "all"
    ? (projects?.map((p) => p.id) ?? [])
    : [selectedProjectId];

  // Server-side: get unique events with stats (paginated)
  const { data: uniqueEvents } = useQuery({
    queryKey: ["events-explorer", projectIds, debouncedSearch, sortBy, page],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unique_events", {
        p_project_ids: projectIds,
        p_search: debouncedSearch || null,
        p_sort_by: sortBy,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      return (data as UniqueEvent[]) ?? [];
    },
  });

  // Server-side: get total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ["events-explorer-count", projectIds, debouncedSearch],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_unique_events_count", {
        p_project_ids: projectIds,
        p_search: debouncedSearch || null,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
  });

  // Get total event count across all unique events
  const totalEvents = uniqueEvents?.reduce((sum, e) => sum + e.count, 0) ?? 0;
  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  // Server-side: property schema for selected event
  const { data: propertySchema, isLoading: schemaLoading } = useQuery({
    queryKey: ["event-schema", projectIds, selectedEventName],
    enabled: !!selectedEventName && projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_property_schema", {
        p_project_ids: projectIds,
        p_event_name: selectedEventName!,
      });
      if (error) throw error;
      return (data as PropertySchema[]) ?? [];
    },
  });

  // Server-side: paginated event instances for selected event
  const { data: eventInstances } = useQuery({
    queryKey: ["event-instances", projectIds, selectedEventName, instancePage],
    enabled: !!selectedEventName && projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_instances", {
        p_project_ids: projectIds,
        p_event_name: selectedEventName!,
        p_limit: INSTANCE_PAGE_SIZE,
        p_offset: instancePage * INSTANCE_PAGE_SIZE,
      });
      if (error) throw error;
      return (data as EventRow[]) ?? [];
    },
  });

  // Get the selected event's stats from the list
  const selectedEventStats = uniqueEvents?.find((e) => e.name === selectedEventName);

  const exportCSV = async () => {
    // Export all events for this project using paginated fetches
    toast("Exporting events...");
    let allRows: any[] = [];
    let offset = 0;
    const exportLimit = 5000;

    while (offset < exportLimit) {
      const { data, error } = await supabase
        .from("events")
        .select("event_name, user_identifier, page_url, timestamp, properties")
        .in("project_id", projectIds)
        .order("timestamp", { ascending: false })
        .range(offset, offset + 999);

      if (error || !data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    if (allRows.length === 0) return;

    const headers = ["event_name", "user_identifier", "page_url", "timestamp", "properties"];
    const rows = allRows.map((e) => [e.event_name, e.user_identifier ?? "", e.page_url ?? "", e.timestamp, JSON.stringify(e.properties)]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "events.csv";
    a.click();
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Events Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your event dictionary and explore live data.
          </p>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setPage(0); }}>
            <SelectTrigger className="w-48 h-9 text-xs">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live" className="gap-2">
            <Activity className="h-4 w-4" />
            Live Events
          </TabsTrigger>
          <TabsTrigger value="dictionary" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Event Dictionary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {totalCount ?? 0} unique events · {totalEvents.toLocaleString()} total occurrences
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={totalEvents === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search events..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => { setSortBy(sortBy === "count" ? "name" : sortBy === "name" ? "lastSeen" : "count"); setPage(0); }}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === "count" ? "By Volume" : sortBy === "name" ? "A-Z" : "Recent"}
            </Button>
          </div>

          <div className="grid gap-2">
            {(uniqueEvents ?? []).map((ev) => (
              <Card
                key={ev.name}
                className="cursor-pointer transition-all hover:border-primary/30"
                onClick={() => { setSelectedEventName(ev.name); setView("schema"); setInstancePage(0); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm truncate">{ev.name}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {ev.count.toLocaleString()} events
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ev.unique_users} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(ev.last_seen)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!uniqueEvents || uniqueEvents.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {totalEvents === 0 ? "No events yet. Sync from PostHog/Mixpanel or send events via the API." : "No matching events found."}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dictionary" className="mt-6">
          <EventDictionary projectId={selectedProjectId} />
        </TabsContent>
      </Tabs>

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEventName && !selectedInstance} onOpenChange={() => setSelectedEventName(null)}>
        <SheetContent className="sm:max-w-lg w-full p-0">
          <div className="p-6 pb-0">
            <SheetHeader>
              <SheetTitle className="font-mono text-lg">{selectedEventName}</SheetTitle>
            </SheetHeader>
            {selectedEventStats && (
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{selectedEventStats.count.toLocaleString()} total</span>
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedEventStats.unique_users} users</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{timeAgo(selectedEventStats.last_seen)}</span>
              </div>
            )}

            <div className="flex gap-1 mt-4">
              <Button variant={view === "schema" ? "default" : "ghost"} size="sm" className="text-xs h-8" onClick={() => setView("schema")}>
                <Tag className="h-3 w-3 mr-1" /> Property Schema
              </Button>
              <Button variant={view === "instances" ? "default" : "ghost"} size="sm" className="text-xs h-8" onClick={() => { setView("instances"); setInstancePage(0); }}>
                <List className="h-3 w-3 mr-1" /> Recent Events
              </Button>
            </div>
          </div>

          <Separator className="mt-4" />

          <ScrollArea className="h-[calc(100vh-220px)] px-6 py-4">
            {view === "schema" && selectedEventName && (
              <PropertySchemaView schema={propertySchema ?? []} loading={schemaLoading} />
            )}
            {view === "instances" && selectedEventName && (
              <div className="space-y-2">
                {(eventInstances ?? []).map((ev) => (
                  <Card
                    key={ev.id}
                    className="cursor-pointer hover:border-primary/30 transition-all"
                    onClick={() => setSelectedInstance(ev)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span className="font-mono truncate max-w-[150px]">{ev.user_identifier || "anonymous"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(ev.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {/* Instance pagination */}
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={instancePage === 0}
                    onClick={() => setInstancePage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {instancePage + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={(eventInstances ?? []).length < INSTANCE_PAGE_SIZE}
                    onClick={() => setInstancePage((p) => p + 1)}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Instance Detail Sheet */}
      <Sheet open={!!selectedInstance} onOpenChange={() => setSelectedInstance(null)}>
        <SheetContent className="sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle className="font-mono text-base break-all">{selectedInstance?.event_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">User ID</label>
                <div className="font-mono mt-1">{selectedInstance?.user_identifier || "-"}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">Timestamp</label>
                <div className="mt-1">{selectedInstance && new Date(selectedInstance.timestamp).toLocaleString()}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Properties</label>
              <div className="bg-muted/50 rounded-md p-4 space-y-2 font-mono text-sm overflow-x-auto">
                {selectedInstance?.properties && Object.entries(selectedInstance.properties).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-blue-500">{key}:</span>
                    <span className="text-foreground break-all"><PropertyValue value={value} /></span>
                  </div>
                ))}
              </div>
            </div>

            {selectedInstance?.page_url && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">Page URL</label>
                <a href={selectedInstance.page_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                  {selectedInstance.page_url}
                </a>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
