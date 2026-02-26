import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, Search, ChevronRight, Hash, User, Clock, Tag, List, BarChart3, ArrowUpDown, FolderKanban, BookOpen, Activity } from "lucide-react";
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
  lastSeen: string;
  uniqueUsers: number;
  properties: Map<string, { values: Set<string>; type: string; count: number }>;
  sampleEvents: EventRow[];
};

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

function EventSchemaView({ uniqueEvent }: { uniqueEvent: UniqueEvent }) {
  const propEntries = Array.from(uniqueEvent.properties.entries())
    .filter(([key]) => !key.startsWith("$set"))
    .sort((a, b) => b[1].count - a[1].count);

  const userProps = propEntries.filter(([k]) => !k.startsWith("$"));
  const systemProps = propEntries.filter(([k]) => k.startsWith("$"));

  const renderSchemaGroup = (items: [string, { values: Set<string>; type: string; count: number }][], label: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2">{label}</p>
        <div className="space-y-0.5">
          {items.map(([key, info]) => {
            const sampleValues = Array.from(info.values).slice(0, 3);
            return (
              <div key={key} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/50">
                <span className="text-xs font-mono text-muted-foreground shrink-0 min-w-[140px] truncate" title={key}>
                  {key.replace(/^\$/, "")}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">{info.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {info.count}/{uniqueEvent.count} events
                    </span>
                  </div>
                  {sampleValues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sampleValues.map((v, i) => (
                        <span key={i} className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate max-w-[150px]">
                          {v}
                        </span>
                      ))}
                      {info.values.size > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{info.values.size - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderSchemaGroup(userProps, "Custom Properties")}
      {userProps.length > 0 && systemProps.length > 0 && <Separator />}
      {renderSchemaGroup(systemProps, "System Properties")}
      {propEntries.length === 0 && <p className="text-sm text-muted-foreground italic py-4">No properties recorded</p>}
    </div>
  );
}

export function EventsExplorer() {
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<UniqueEvent | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EventRow | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "name" | "lastSeen">("count");
  const [view, setView] = useState<"schema" | "instances">("schema");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Fetch profile for github URL
  const { data: profile } = useQuery({
    queryKey: ["profile-github"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("onboarding_data").eq("user_id", user.id).single();
      return data;
    },
  });
  const githubUrl = (profile?.onboarding_data as any)?.codebase?.github_url;
  const githubPat = (profile?.onboarding_data as any)?.codebase?.github_pat;

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

  const { data: events } = useQuery({
    queryKey: ["events-explorer", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("project_id", projectIds)
        .order("timestamp", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const uniqueEvents = useMemo(() => {
    if (!events) return [];
    const map = new Map<string, UniqueEvent>();

    for (const ev of events) {
      let entry = map.get(ev.event_name);
      if (!entry) {
        entry = {
          name: ev.event_name,
          count: 0,
          lastSeen: ev.timestamp,
          uniqueUsers: 0,
          properties: new Map(),
          sampleEvents: [],
        };
        map.set(ev.event_name, entry);
      }
      entry.count++;
      if (new Date(ev.timestamp) > new Date(entry.lastSeen)) entry.lastSeen = ev.timestamp;
      if (entry.sampleEvents.length < 20) entry.sampleEvents.push(ev);

      // Collect property schema
      if (ev.properties && typeof ev.properties === "object") {
        for (const [key, val] of Object.entries(ev.properties)) {
          let prop = entry.properties.get(key);
          if (!prop) {
            prop = { values: new Set(), type: typeof val, count: 0 };
            entry.properties.set(key, prop);
          }
          prop.count++;
          if (val !== null && val !== undefined && prop.values.size < 20) {
            prop.values.add(String(val).slice(0, 80));
          }
        }
      }
    }

    // Calculate unique users
    for (const entry of map.values()) {
      const users = new Set(entry.sampleEvents.map((e) => e.user_identifier).filter(Boolean));
      entry.uniqueUsers = users.size;
    }

    return Array.from(map.values());
  }, [events]);

  const filtered = useMemo(() => {
    let result = uniqueEvents;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(s));
    }
    result.sort((a, b) => {
      if (sortBy === "count") return b.count - a.count;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
    return result;
  }, [uniqueEvents, search, sortBy]);

  const totalEvents = events?.length ?? 0;

  const exportCSV = () => {
    if (!events?.length) return;
    const headers = ["event_name", "user_identifier", "page_url", "timestamp", "properties"];
    const rows = events.map((e) => [e.event_name, e.user_identifier ?? "", e.page_url ?? "", e.timestamp, JSON.stringify(e.properties)]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
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
        
        {/* Project selector - Global for both tabs */}
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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
              {filtered.length} unique events · {totalEvents.toLocaleString()} total occurrences
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={totalEvents === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setSortBy(sortBy === "count" ? "name" : sortBy === "name" ? "lastSeen" : "count")}
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortBy === "count" ? "By Volume" : sortBy === "name" ? "A-Z" : "Recent"}
            </Button>
          </div>

          <div className="grid gap-2">
            {filtered.map((ev) => (
              <Card
                key={ev.name}
                className="cursor-pointer transition-all hover:border-primary/30"
                onClick={() => { setSelectedEvent(ev); setView("schema"); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm truncate">{ev.name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {ev.properties.size} props
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {ev.count.toLocaleString()} events
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ev.uniqueUsers} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(ev.lastSeen)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {totalEvents === 0 ? "No events yet. Sync from PostHog/Mixpanel or send events via the API." : "No matching events found."}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dictionary" className="mt-6">
          <EventDictionary projectId={selectedProjectId} githubUrl={githubUrl} githubPat={githubPat} />
        </TabsContent>
      </Tabs>

      {/* Event Detail Sheet */}
      <Sheet open={!!selectedEvent && !selectedInstance} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent className="sm:max-w-lg w-full p-0">
          <div className="p-6 pb-0">
            <SheetHeader>
              <SheetTitle className="font-mono text-lg">{selectedEvent?.name}</SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" />{selectedEvent?.count.toLocaleString()} total</span>
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedEvent?.uniqueUsers} users</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{selectedEvent && timeAgo(selectedEvent.lastSeen)}</span>
            </div>

            <div className="flex gap-1 mt-4">
              <Button variant={view === "schema" ? "default" : "ghost"} size="sm" className="text-xs h-8" onClick={() => setView("schema")}>
                <Tag className="h-3 w-3 mr-1" /> Property Schema
              </Button>
              <Button variant={view === "instances" ? "default" : "ghost"} size="sm" className="text-xs h-8" onClick={() => setView("instances")}>
                <List className="h-3 w-3 mr-1" /> Recent Events
              </Button>
            </div>
          </div>

          <Separator className="mt-4" />

          <ScrollArea className="h-[calc(100vh-220px)] px-6 py-4">
            {view === "schema" && selectedEvent && <EventSchemaView uniqueEvent={selectedEvent} />}
            {view === "instances" && selectedEvent && (
              <div className="space-y-2">
                {selectedEvent.sampleEvents.map((ev) => (
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
                    <span className="text-foreground break-all">{JSON.stringify(value)}</span>
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
