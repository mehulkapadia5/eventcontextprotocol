import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Edit, Save, X, Sparkles, CheckCircle2, Eye, Bot, PenLine, RefreshCw, Code2, Radio, UserPen, ChevronDown, ChevronRight, GitBranch, Search, Brain, Play, FileCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCodebaseIndexer, type PipelineStep } from "@/hooks/use-codebase-indexer";

interface EventAnnotation {
  id: string;
  event_name: string;
  description: string | null;
  category: string | null;
  status: 'discovered' | 'verified' | 'deprecated';
  updated_at: string;
  project_id: string;
}

interface MergedEvent {
  id: string | null;
  event_name: string;
  description: string | null;
  category: string | null;
  status: 'discovered' | 'verified' | 'deprecated' | 'unannotated';
  updated_at: string | null;
  project_id: string;
  liveCount: number;
  isAnnotated: boolean;
}

function StatsCards({ events }: { events: MergedEvent[] }) {
  const total = events.length;
  const discovered = events.filter(a => a.status === "discovered").length;
  const verified = events.filter(a => a.status === "verified").length;
  const annotated = events.filter(a => a.isAnnotated).length;
  const annotatedPct = total > 0 ? Math.round((annotated / total) * 100) : 0;

  const stats = [
    { label: "Total Events", value: total, icon: Eye, color: "text-foreground" },
    { label: "AI Discovered", value: discovered, icon: Bot, color: "text-blue-500" },
    { label: "Verified", value: verified, icon: CheckCircle2, color: "text-green-500" },
    { label: "Annotated", value: `${annotatedPct}%`, sublabel: `${annotated}/${total}`, icon: PenLine, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{stat.value}</span>
              {stat.sublabel && <span className="text-xs text-muted-foreground">{stat.sublabel}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PipelineStepper({ currentStep, stepMessage, error, isRunning, onRun }: {
  currentStep: PipelineStep;
  stepMessage: string;
  error: string | null;
  isRunning: boolean;
  onRun: () => void;
}) {
  const steps = [
    { key: "indexing", label: "Index Repo", icon: GitBranch },
    { key: "searching", label: "Search Events", icon: Search },
    { key: "analyzing", label: "Analyze", icon: Brain },
  ] as const;

  const getStepState = (stepKey: string) => {
    const order = ["indexing", "searching", "analyzing"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepKey);
    if (currentStep === "done") return "done";
    if (currentStep === "error") return stepIdx <= currentIdx ? "error" : "pending";
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Codebase Analysis Pipeline</h4>
          <Button size="sm" onClick={onRun} disabled={isRunning}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isRunning ? "Running..." : "Discover Events from Code"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const state = getStepState(step.key);
            return (
              <div key={step.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium flex-1 ${
                  state === "active" ? "bg-primary/10 text-primary border border-primary/20" :
                  state === "done" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                  state === "error" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                  "bg-muted text-muted-foreground border border-transparent"
                }`}>
                  <step.icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{step.label}</span>
                  {state === "active" && <RefreshCw className="h-3 w-3 animate-spin ml-auto shrink-0" />}
                  {state === "done" && <CheckCircle2 className="h-3 w-3 ml-auto shrink-0" />}
                </div>
                {idx < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
        {(stepMessage || error) && (
          <p className={`text-xs mt-2 ${error ? "text-destructive" : "text-muted-foreground"}`}>
            {error || stepMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IndexerStatusCard({ indexStatus, isRunning, onIndex }: {
  indexStatus: any;
  isRunning: boolean;
  onIndex: () => void;
}) {
  if (!indexStatus) return null;

  const progress = indexStatus.total_files > 0
    ? Math.round((indexStatus.indexed_files / indexStatus.total_files) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Repository Index</span>
            <Badge variant="outline" className={`text-[10px] capitalize ${
              indexStatus.status === "completed" ? "bg-green-500/10 text-green-600 border-green-500/20" :
              indexStatus.status === "indexing" ? "bg-primary/10 text-primary border-primary/20" :
              indexStatus.status === "failed" ? "bg-destructive/10 text-destructive border-destructive/20" :
              ""
            }`}>
              {indexStatus.status}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onIndex} disabled={isRunning}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRunning ? "animate-spin" : ""}`} />
            Re-index
          </Button>
        </div>
        {indexStatus.github_url && (
          <p className="text-xs text-muted-foreground mb-2 truncate">{indexStatus.github_url}</p>
        )}
        {indexStatus.status === "indexing" && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-[10px] text-muted-foreground">{indexStatus.indexed_files} / {indexStatus.total_files} files</p>
          </div>
        )}
        {indexStatus.status === "completed" && (
          <p className="text-xs text-muted-foreground">
            {indexStatus.indexed_files} files indexed
            {indexStatus.last_indexed_at && ` • Last indexed ${new Date(indexStatus.last_indexed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${new Date(indexStatus.last_indexed_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        )}
        {indexStatus.status === "failed" && indexStatus.error_message && (
          <p className="text-xs text-destructive">{indexStatus.error_message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CodeLocationsRow({ eventName, locations }: {
  eventName: string;
  locations: Array<{ file_path: string; line_number: number; code_snippet: string; semantic_meaning: string | null }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (locations.length === 0) return null;

  return (
    <TableRow className="bg-muted/20 border-t-0">
      <TableCell colSpan={6} className="p-0">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-left">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <FileCode className="h-3 w-3" />
            <span>{locations.length} code location{locations.length !== 1 ? "s" : ""}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-3 space-y-2">
              {locations.map((loc, idx) => (
                <div key={idx} className="rounded-md border bg-background p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-primary">{loc.file_path}</span>
                    <Badge variant="outline" className="text-[10px]">line {loc.line_number}</Badge>
                  </div>
                  {loc.semantic_meaning && (
                    <p className="text-xs text-muted-foreground">{loc.semantic_meaning}</p>
                  )}
                  <pre className="text-[11px] bg-muted p-2 rounded overflow-x-auto max-h-40 font-mono leading-relaxed">
                    {loc.code_snippet}
                  </pre>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </TableCell>
    </TableRow>
  );
}

function EditableRow({ 
  ann, 
  onSave, 
  onCancel, 
  saving 
}: { 
  ann: MergedEvent; 
  onSave: (data: { event_name: string; description: string; category: string; status: string }) => void; 
  onCancel: () => void;
  saving: boolean;
}) {
  const [desc, setDesc] = useState(ann.description || "");
  const [cat, setCat] = useState(ann.category || "core");
  const [status, setStatus] = useState<string>(ann.status === "unannotated" ? "discovered" : ann.status);

  return (
    <TableRow className="bg-muted/30">
      <TableCell className="font-mono text-sm font-medium">{ann.event_name}</TableCell>
      <TableCell>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Describe what this event means..."
          className="min-h-[60px] text-sm"
        />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">—</TableCell>
      <TableCell>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="acquisition">Acquisition</SelectItem>
            <SelectItem value="activation">Activation</SelectItem>
            <SelectItem value="retention">Retention</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="core">Core Product</SelectItem>
            <SelectItem value="content">Content</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="discovered">Discovered</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button variant="default" size="icon" className="h-7 w-7" onClick={() => onSave({ event_name: ann.event_name, description: desc, category: cat, status })} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function EventDictionary({ projectId, githubUrl: initialGithubUrl, githubPat: initialGithubPat }: { projectId: string; githubUrl?: string; githubPat?: string }) {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [formData, setFormData] = useState({ event_name: "", description: "", category: "core", status: "verified" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [isGithubDialogOpen, setIsGithubDialogOpen] = useState(false);
  const [scanGithubUrl, setScanGithubUrl] = useState(initialGithubUrl || "");
  const [scanGithubPat, setScanGithubPat] = useState(initialGithubPat || "");

  const queryClient = useQueryClient();
  const indexer = useCodebaseIndexer(projectId, scanGithubUrl || initialGithubUrl, scanGithubPat || initialGithubPat);

  // Fetch annotations
  const { data: annotations } = useQuery({
    queryKey: ["event-annotations", projectId],
    enabled: projectId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_annotations")
        .select("*")
        .eq("project_id", projectId)
        .order("event_name");
      if (error) throw error;
      return data as EventAnnotation[];
    },
  });

  // Fetch live events to get unique event names + counts
  const { data: liveEventCounts } = useQuery({
    queryKey: ["live-event-counts", projectId],
    enabled: projectId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("event_name")
        .eq("project_id", projectId);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const ev of data || []) {
        counts.set(ev.event_name, (counts.get(ev.event_name) || 0) + 1);
      }
      return counts;
    },
  });

  // Fetch codebase files to determine source + last synced time
  const { data: codebaseFilesData } = useQuery({
    queryKey: ["codebase-files", projectId],
    enabled: projectId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("codebase_files" as any)
        .select("file_path, content_snippet, last_synced_at")
        .eq("project_id", projectId)
        .eq("has_tracking_calls", true);
      if (error) throw error;
      const eventNames = new Set<string>();
      let latestSync: string | null = null;
      for (const file of (data || []) as any[]) {
        const snippet = file.content_snippet || "";
        const regex = /\.(capture|track|logEvent|send)\s*\(\s*['"]([\w.:\-/ ]+)['"]/g;
        let match;
        while ((match = regex.exec(snippet)) !== null) {
          eventNames.add(match[2]);
        }
        if (file.last_synced_at && (!latestSync || file.last_synced_at > latestSync)) {
          latestSync = file.last_synced_at;
        }
      }
      return { eventNames, latestSync };
    },
  });

  const codebaseFiles = codebaseFilesData?.eventNames;
  const lastSyncedAt = codebaseFilesData?.latestSync;

  // Build code locations map from indexer
  const codeLocationsMap = useMemo(() => {
    const map = new Map<string, Array<{ file_path: string; line_number: number; code_snippet: string; semantic_meaning: string | null }>>();
    for (const loc of indexer.codeLocations) {
      const arr = map.get(loc.event_name) || [];
      arr.push(loc);
      map.set(loc.event_name, arr);
    }
    return map;
  }, [indexer.codeLocations]);

  // Merge live events with annotations
  const mergedEvents = useMemo(() => {
    const annotationMap = new Map<string, EventAnnotation>();
    for (const ann of annotations || []) {
      annotationMap.set(ann.event_name, ann);
    }

    const allNames = new Set<string>();
    for (const name of annotationMap.keys()) allNames.add(name);
    for (const name of liveEventCounts?.keys() || []) allNames.add(name);

    const result: MergedEvent[] = [];
    for (const name of allNames) {
      const ann = annotationMap.get(name);
      const count = liveEventCounts?.get(name) || 0;
      if (ann) {
        result.push({
          id: ann.id, event_name: ann.event_name, description: ann.description,
          category: ann.category, status: ann.status, updated_at: ann.updated_at,
          project_id: ann.project_id, liveCount: count, isAnnotated: true,
        });
      } else {
        result.push({
          id: null, event_name: name, description: null, category: null,
          status: "unannotated", updated_at: null, project_id: projectId,
          liveCount: count, isAnnotated: false,
        });
      }
    }
    result.sort((a, b) => a.event_name.localeCompare(b.event_name));
    return result;
  }, [annotations, liveEventCounts, projectId]);

  const upsertMutation = useMutation({
    mutationFn: async (vars: any) => {
      const { error } = await supabase
        .from("event_annotations")
        .upsert({ ...vars, project_id: projectId }, { onConflict: "event_name,project_id" })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-annotations"] });
      toast.success("Saved successfully");
      setIsAddOpen(false);
      setEditingName(null);
      setFormData({ event_name: "", description: "", category: "core", status: "verified" });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_annotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-annotations"] });
      toast.success("Deleted successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleInlineSave = (data: { event_name: string; description: string; category: string; status: string }) => {
    upsertMutation.mutate(data);
  };

  const handleAddSave = () => {
    if (!formData.event_name) return toast.error("Event name is required");
    upsertMutation.mutate(formData);
  };

  const handleRescan = async (url?: string, pat?: string) => {
    const resolvedUrl = url || initialGithubUrl || scanGithubUrl;
    const resolvedPat = pat || initialGithubPat || scanGithubPat;
    if (!resolvedUrl) {
      setIsGithubDialogOpen(true);
      return;
    }
    setIsScanning(true);
    setIsGithubDialogOpen(false);
    try {
      const resp = await supabase.functions.invoke("index-codebase-events", {
        body: { project_id: projectId, github_url: resolvedUrl, github_pat: resolvedPat },
      });
      if (resp.error) throw resp.error;
      const result = resp.data;
      toast.success(`Scan complete: ${result.tracking_calls_found} tracking calls found, ${result.events_discovered} new events discovered`);
      queryClient.invalidateQueries({ queryKey: ["event-annotations"] });
      queryClient.invalidateQueries({ queryKey: ["codebase-files"] });
    } catch (err: any) {
      toast.error(err.message || "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunPipeline = async () => {
    toast.info("Starting codebase analysis pipeline...");
    try {
      await indexer.runPipeline();
      toast.success("Pipeline complete! Events discovered and analyzed.");
    } catch (err: any) {
      toast.error(err.message || "Pipeline failed");
    }
  };

  const getEventSource = (eventName: string): "codebase" | "live" | "manual" => {
    if (codebaseFiles?.has(eventName) || codeLocationsMap.has(eventName)) return "codebase";
    const count = liveEventCounts?.get(eventName) || 0;
    const ann = (annotations || []).find((a) => a.event_name === eventName);
    if (count > 0 && !ann) return "live";
    if (ann && ann.status !== "discovered") return "manual";
    return "live";
  };

  const filtered = mergedEvents.filter(a => {
    const matchesSearch = a.event_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (projectId === "all") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <div className="p-3 rounded-full bg-muted">
          <Edit className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Select a Project</h3>
        <p className="text-muted-foreground max-w-sm">
          To view and manage the event dictionary, please select a specific project from the dropdown above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {mergedEvents.length > 0 && <StatsCards events={mergedEvents} />}

      {/* Pipeline Stepper */}
      <PipelineStepper
        currentStep={indexer.currentStep}
        stepMessage={indexer.stepMessage}
        error={indexer.error}
        isRunning={indexer.isRunning}
        onRun={handleRunPipeline}
      />

      {/* Indexer Status Card */}
      {indexer.indexStatus && (
        <IndexerStatusCard
          indexStatus={indexer.indexStatus}
          isRunning={indexer.isRunning}
          onIndex={() => indexer.runStep("index").catch(() => {})}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative w-full max-w-sm">
            <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unannotated">Unannotated</SelectItem>
              <SelectItem value="discovered">Discovered</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <Button variant="outline" size="sm" onClick={() => handleRescan()} disabled={isScanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "Scan Codebase"}
            </Button>
            {lastSyncedAt && (
              <span className="text-[10px] text-muted-foreground">
                Last synced {new Date(lastSyncedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} at {new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => {
              setEditingName(null);
              setFormData({ event_name: "", description: "", category: "core", status: "verified" });
            }}>
              <Plus className="h-4 w-4 mr-2" /> Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input value={formData.event_name} onChange={(e) => setFormData({ ...formData, event_name: e.target.value })} placeholder="e.g. signup_completed" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What does this event mean?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acquisition">Acquisition</SelectItem>
                      <SelectItem value="activation">Activation</SelectItem>
                      <SelectItem value="retention">Retention</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="core">Core Product</SelectItem>
                      <SelectItem value="content">Content</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discovered">Discovered (AI)</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isGithubDialogOpen} onOpenChange={setIsGithubDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect GitHub Repository</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Repository URL</Label>
                <Input value={scanGithubUrl} onChange={(e) => setScanGithubUrl(e.target.value)} placeholder="https://github.com/org/repo" />
              </div>
              <div className="space-y-2">
                <Label>Personal Access Token (optional)</Label>
                <Input type="password" value={scanGithubPat} onChange={(e) => setScanGithubPat(e.target.value)} placeholder="ghp_... (required for private repos)" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGithubDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => handleRescan(scanGithubUrl, scanGithubPat)} disabled={!scanGithubUrl || isScanning}>
                {isScanning ? "Scanning..." : "Scan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Event Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Source</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p>No events found.</p>
                  <p className="text-xs">Sync events from your analytics provider or run the codebase analysis pipeline above.</p>
                </div>
              </TableCell></TableRow>
            ) : (
              filtered.map((ev) =>
                editingName === ev.event_name ? (
                  <EditableRow
                    key={ev.event_name}
                    ann={ev}
                    onSave={handleInlineSave}
                    onCancel={() => setEditingName(null)}
                    saving={upsertMutation.isPending}
                  />
                ) : (
                  <>
                    <TableRow key={ev.event_name}>
                      <TableCell className="font-mono text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {ev.event_name}
                          {ev.liveCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono shrink-0">
                              {ev.liveCount.toLocaleString()}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px] text-muted-foreground">
                        <div className="flex items-start gap-1.5">
                          {!ev.isAnnotated && (
                            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <span className="text-sm line-clamp-2" title={ev.description || ""}>
                            {ev.description || <span className="italic text-muted-foreground/60">No description — click edit to add one</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const source = getEventSource(ev.event_name);
                          const icon = source === "codebase" ? <Code2 className="h-3 w-3 mr-1" /> : source === "live" ? <Radio className="h-3 w-3 mr-1" /> : <UserPen className="h-3 w-3 mr-1" />;
                          return (
                            <Badge variant="outline" className="text-[10px] capitalize font-normal">
                              {icon}{source}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {ev.category && <Badge variant="outline" className="capitalize font-normal text-xs">{ev.category}</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${
                            ev.status === 'verified' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                            ev.status === 'deprecated' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            ev.status === 'unannotated' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                            'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          }`}
                        >
                          {ev.status === "discovered" && <Bot className="h-3 w-3 mr-1" />}
                          {ev.status === "unannotated" ? "New" : ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingName(ev.event_name)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {ev.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this annotation?")) deleteMutation.mutate(ev.id!);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Code Locations expandable row */}
                    {codeLocationsMap.has(ev.event_name) && (
                      <CodeLocationsRow
                        key={`${ev.event_name}-locations`}
                        eventName={ev.event_name}
                        locations={codeLocationsMap.get(ev.event_name)!}
                      />
                    )}
                  </>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
