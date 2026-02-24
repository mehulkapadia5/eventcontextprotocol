import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, FolderPlus, Key, RefreshCw, Trash2 } from "lucide-react";

export function ProjectsPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newProjectName, setNewProjectName] = useState("");

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ name, user_id: session!.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNewProjectName("");
      toast({ title: "Project created" });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project deleted" });
    },
  });

  const regenerateKey = useMutation({
    mutationFn: async (id: string) => {
      // Generate new key client-side using crypto
      const newKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const { error } = await supabase.from("projects").update({ api_key: newKey }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "API key regenerated" });
    },
  });

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "API key copied" });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Projects</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create New Project</CardTitle>
          <CardDescription>Each project gets a unique API key for event tracking.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newProjectName.trim()) createProject.mutate(newProjectName.trim());
            }}
            className="flex gap-3"
          >
            <Input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit" disabled={createProject.isPending || !newProjectName.trim()}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {projects?.map((project) => (
          <Card key={project.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  ID: {project.id}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteProject.mutate(project.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <Label className="text-xs text-muted-foreground">API Key</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-accent/30 border border-border rounded px-3 py-2 font-mono text-xs break-all">
                  {project.api_key}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyKey(project.api_key)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => regenerateKey.mutate(project.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
        {projects?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No projects yet. Create one above to get started.</p>
        )}
      </div>
    </div>
  );
}
