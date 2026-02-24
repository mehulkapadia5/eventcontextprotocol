import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Activity, GitBranch, Sparkles, Check, CheckCircle2, MessageSquare, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

export function OnboardingCards() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState<"posthog" | "mixpanel" | "github" | null>(null);

  const [posthogKey, setPosthogKey] = useState("");
  const [mixpanelKey, setMixpanelKey] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data, onboarding_completed")
      .eq("user_id", session.user.id)
      .single();
    const od = (profile as any)?.onboarding_data as OnboardingData | null;
    if (od) {
      setData(od);
      setPosthogKey(od.analytics?.posthog_key || "");
      setMixpanelKey(od.analytics?.mixpanel_key || "");
      setGithubUrl(od.codebase?.github_url || "");
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveData = async (updated: OnboardingData, connectedType?: "posthog" | "mixpanel" | "github") => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const allDone = !!(updated.analytics?.posthog_key || updated.analytics?.mixpanel_key) &&
        !!updated.codebase?.github_url &&
        !!updated.business?.product_description;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: updated,
          onboarding_completed: allDone,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setData(updated);
      if (connectedType) {
        setConnected(connectedType);
        setTimeout(() => {
          setConnected(null);
          setOpenDialog(null);
        }, 1500);
      } else {
        setOpenDialog(null);
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const analyticsConnected = !!(data.analytics?.posthog_key || data.analytics?.mixpanel_key);
  const codebaseConnected = !!data.codebase?.github_url;
  const businessDone = !!data.business?.product_description;

  if (!loading && analyticsConnected && codebaseConnected && businessDone) return null;
  if (loading) return null;

  const steps = [
    { title: "Connect Analytics", description: "Link PostHog or Mixpanel to import event data", icon: Activity, done: analyticsConnected },
    { title: "Connect Codebase", description: "Link your GitHub repository for code-aware insights", icon: GitBranch, done: codebaseConnected },
    { title: "Business Context", description: "Chat with AI to describe your product", icon: Sparkles, done: businessDone },
  ];

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Get Started</h2>
          <Badge variant="secondary" className="font-mono text-xs">
            {steps.filter((s) => s.done).length}/{steps.length} complete
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, i) => (
            <Card
              key={i}
              className={`transition-all ${step.done ? "border-primary/40 opacity-75" : "cursor-pointer hover:border-primary/30"}`}
              onClick={() => {
                if (step.done) return;
                if (i === 2) {
                  navigate("/dashboard/chat");
                } else {
                  setOpenDialog(i);
                }
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? "bg-primary/20" : "bg-muted"}`}>
                      {step.done ? <Check className="h-4 w-4 text-primary" /> : <step.icon className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{step.title}</CardTitle>
                      <CardDescription className="text-xs">{step.description}</CardDescription>
                    </div>
                  </div>
                  {!step.done && (
                    i === 2
                      ? <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      : <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpenDialog(i); }}>Connect</Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Analytics Dialog */}
      <Dialog open={openDialog === 0} onOpenChange={(open) => { if (!open) { setOpenDialog(null); setConnected(null); } }}>
        <DialogContent className="sm:max-w-md">
          {connected === "posthog" || connected === "mixpanel" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-lg">
                {connected === "posthog" ? "PostHog" : "Mixpanel"} Connected!
              </p>
              <p className="text-sm text-muted-foreground">Your analytics data will be synced shortly.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Connect Analytics</DialogTitle>
                <DialogDescription>Connect one of the following analytics platforms.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>PostHog API Key</Label>
                  <Input placeholder="phc_..." value={posthogKey} onChange={(e) => setPosthogKey(e.target.value)} />
                  <Button
                    className="w-full"
                    disabled={!posthogKey || saving}
                    onClick={() => saveData({ ...data, analytics: { posthog_key: posthogKey } }, "posthog")}
                  >
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : "Connect PostHog"}
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Mixpanel Project Token</Label>
                  <Input placeholder="Token..." value={mixpanelKey} onChange={(e) => setMixpanelKey(e.target.value)} />
                  <Button
                    className="w-full"
                    disabled={!mixpanelKey || saving}
                    onClick={() => saveData({ ...data, analytics: { mixpanel_key: mixpanelKey } }, "mixpanel")}
                  >
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : "Connect Mixpanel"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Codebase Dialog */}
      <Dialog open={openDialog === 1} onOpenChange={(open) => { if (!open) { setOpenDialog(null); setConnected(null); } }}>
        <DialogContent className="sm:max-w-md">
          {connected === "github" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-lg">Repository Connected!</p>
              <p className="text-sm text-muted-foreground">Code-aware insights are being set up.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Connect Codebase</DialogTitle>
                <DialogDescription>Link your GitHub repository for code-aware insights.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>GitHub Repository URL</Label>
                  <Input placeholder="https://github.com/org/repo" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!githubUrl || saving}
                  onClick={() => saveData({ ...data, codebase: { github_url: githubUrl } }, "github")}
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : "Connect Repository"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
