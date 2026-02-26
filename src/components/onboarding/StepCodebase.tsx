import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Code2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StepCodebaseProps {
  data: { github_url?: string; github_pat?: string };
  onUpdate: (data: { github_url?: string; github_pat?: string }) => void;
  onNext: () => void;
  onSkip: () => void;
  projectId?: string;
}

export function StepCodebase({ data, onUpdate, onNext, onSkip, projectId }: StepCodebaseProps) {
  const [showInput, setShowInput] = useState(false);
  const isConnected = !!data.github_url;

  const handleSave = async () => {
    setShowInput(false);
    // Trigger deep codebase scan in background
    if (data.github_url && projectId) {
      toast.info("Scanning codebase for events...");
      try {
        const resp = await supabase.functions.invoke("index-codebase-events", {
          body: { project_id: projectId, github_url: data.github_url, github_pat: data.github_pat },
        });
        if (resp.error) throw resp.error;
        const result = resp.data;
        toast.success(`Found ${result.tracking_calls_found} tracking calls, discovered ${result.events_discovered} events`);
      } catch (err: any) {
        console.error("Codebase scan error:", err);
        toast.error("Codebase scan failed, but your GitHub URL was saved");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Code2 className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Connect Codebase</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Link your GitHub repository so ECP can provide code-aware insights and context.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <Card className={isConnected ? "border-primary" : ""}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">GitHub</CardTitle>
                <CardDescription>Connect your repository</CardDescription>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" /> Connected
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowInput(!showInput)}>
                  {showInput ? "Cancel" : "Connect Repository"}
                </Button>
              )}
            </div>
          </CardHeader>
          {(showInput || isConnected) && (
            <CardContent className="pt-0 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/org/repo"
                  value={data.github_url || ""}
                  onChange={(e) => onUpdate({ ...data, github_url: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="password"
                  placeholder="ghp_... (Personal Access Token)"
                  value={data.github_pat || ""}
                  onChange={(e) => onUpdate({ ...data, github_pat: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Optional for public repos, required for private repos.</p>
              </div>
              {!isConnected && (
                <Button
                  size="sm"
                  disabled={!data.github_url}
                  onClick={handleSave}
                >
                  Save
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <div className="flex justify-center gap-3 pt-4">
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}