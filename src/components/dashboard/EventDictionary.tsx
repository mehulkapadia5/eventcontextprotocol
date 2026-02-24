import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface EventAnnotation {
  id: string;
  event_name: string;
  description: string | null;
  category: string | null;
  status: 'discovered' | 'verified' | 'deprecated';
  updated_at: string;
  project_id: string;
}

export function EventDictionary({ projectId }: { projectId: string }) {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ event_name: "", description: "", category: "core", status: "verified" });
  
  const queryClient = useQueryClient();

  const { data: annotations, isLoading } = useQuery({
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

  const upsertMutation = useMutation({
    mutationFn: async (vars: any) => {
      const { error } = await supabase
        .from("event_annotations")
        .upsert({ ...vars, project_id: projectId })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-annotations"] });
      toast.success("Saved successfully");
      setIsAddOpen(false);
      setEditingId(null);
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

  const handleEdit = (ann: EventAnnotation) => {
    setFormData({
      event_name: ann.event_name,
      description: ann.description || "",
      category: ann.category || "core",
      status: (ann.status as any) || "verified"
    });
    setEditingId(ann.id);
    setIsAddOpen(true);
  };

  const handleSave = () => {
    if (!formData.event_name) return toast.error("Event name is required");
    upsertMutation.mutate(editingId ? { ...formData, id: editingId } : formData);
  };

  const filtered = annotations?.filter(a => 
    a.event_name.toLowerCase().includes(search.toLowerCase()) || 
    (a.description?.toLowerCase() || "").includes(search.toLowerCase())
  ) || [];

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Input 
            placeholder="Search events..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { 
              setEditingId(null); 
              setFormData({ event_name: "", description: "", category: "core", status: "verified" }); 
            }}>
              <Plus className="h-4 w-4 mr-2" /> Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Event" : "Add New Event"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input 
                  value={formData.event_name}
                  onChange={(e) => setFormData({...formData, event_name: e.target.value})}
                  placeholder="e.g. signup_completed"
                  disabled={!!editingId}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What does this event mean?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
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
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
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
              <Button onClick={handleSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <p>No events found in dictionary.</p>
                  <p className="text-xs">Connect your codebase to auto-discover events or add them manually.</p>
                </div>
              </TableCell></TableRow>
            ) : (
              filtered.map((ann) => (
                <TableRow key={ann.id}>
                  <TableCell className="font-mono text-sm font-medium">{ann.event_name}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground" title={ann.description || ""}>{ann.description || "-"}</TableCell>
                  <TableCell>
                    {ann.category && <Badge variant="outline" className="capitalize font-normal">{ann.category}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${
                        ann.status === 'verified' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                        ann.status === 'deprecated' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                        'bg-blue-500/10 text-blue-600 border-blue-500/20'
                      }`}
                    >
                      {ann.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(ann)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this annotation?")) deleteMutation.mutate(ann.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
