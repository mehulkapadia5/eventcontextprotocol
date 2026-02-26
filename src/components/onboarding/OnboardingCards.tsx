import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Check, CheckCircle2, MessageSquare, Loader2, FolderPlus, Sparkles, Key, Trash2 } from "lucide-react";
import posthogLogo from "@/assets/posthog-logo.png";
import mixpanelLogo from "@/assets/mixpanel-logo.png";
import gaLogo from "@/assets/ga-logo.svg";
import metabaseLogo from "@/assets/metabase-logo.svg";
import githubLogo from "@/assets/github-logo.png";
import supabaseLogo from "@/assets/supabase-logo.png";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

interface OnboardingData {
  analytics?: {
    posthog_key?: string;
    mixpanel_key?: string;
    posthog_personal_key?: string;
    posthog_project_id?: string;
    posthog_host?: string;
    mixpanel_secret?: string;
    mixpanel_project_id?: string;
    ga_property_id?: string;
    ga_service_account_json?: string;
    metabase_url?: string;
    metabase_username?: string;
    metabase_password?: string;
    supabase_url?: string;
    supabase_anon_key?: string;
    supabase_table?: string;
  };
  codebase?: { github_url?: string; github_pat?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
  project_created?: boolean;
}

export function OnboardingCards() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState<number | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<"posthog" | "mixpanel" | "ga" | "metabase" | "supabase">("posthog");
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState<"posthog" | "mixpanel" | "ga" | "metabase" | "supabase" | "github" | "project" | null>(null);

  const [posthogKey, setPosthogKey] = useState("");
  const [mixpanelKey, setMixpanelKey] = useState("");
  const [posthogPersonalKey, setPosthogPersonalKey] = useState("");
  const [posthogProjectId, setPosthogProjectId] = useState("");
  const [posthogHost, setPosthogHost] = useState("https://us.i.posthog.com");
  const [mixpanelSecret, setMixpanelSecret] = useState("");
  const [mixpanelProjectId, setMixpanelProjectId] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [gaPropertyId, setGaPropertyId] = useState("");
  const [gaServiceAccountJson, setGaServiceAccountJson] = useState("");
  const [metabaseUrl, setMetabaseUrl] = useState("");
  const [metabaseUsername, setMetabaseUsername] = useState("");
  const [metabasePassword, setMetabasePassword] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabaseTable, setSupabaseTable] = useState("events");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const { data: projects, refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const hasProject = (projects?.length ?? 0) > 0;

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
      setPosthogPersonalKey(od.analytics?.posthog_personal_key || "");
      setPosthogProjectId(od.analytics?.posthog_project_id || "");
      setPosthogHost(od.analytics?.posthog_host || "https://us.i.posthog.com");
      setMixpanelSecret(od.analytics?.mixpanel_secret || "");
      setMixpanelProjectId(od.analytics?.mixpanel_project_id || "");
      setGaPropertyId(od.analytics?.ga_property_id || "");
      setGaServiceAccountJson(od.analytics?.ga_service_account_json || "");
      setMetabaseUrl(od.analytics?.metabase_url || "");
      setMetabaseUsername(od.analytics?.metabase_username || "");
      setMetabasePassword(od.analytics?.metabase_password || "");
      setSupabaseUrl(od.analytics?.supabase_url || "");
      setSupabaseAnonKey(od.analytics?.supabase_anon_key || "");
      setSupabaseTable(od.analytics?.supabase_table || "events");
      setGithubUrl(od.codebase?.github_url || "");
      setGithubPat(od.codebase?.github_pat || "");
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveData = async (updated: OnboardingData, connectedType?: "posthog" | "mixpanel" | "ga" | "metabase" | "supabase" | "github" | "project") => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const allDone = !!(updated.analytics?.posthog_key || updated.analytics?.mixpanel_key) &&
        !!updated.codebase?.github_url &&
        !!updated.business?.product_description &&
        hasProject;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: updated,
          onboarding_completed: allDone,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setData(updated);

      // Auto-sync events when analytics keys are saved
      const isAnalyticsConnect = connectedType === "posthog" || connectedType === "mixpanel" || connectedType === "ga" || connectedType === "metabase" || connectedType === "supabase";
      if (isAnalyticsConnect) {
        // Fire and forget - sync in background
        supabase.functions.invoke("fetch-external-events").then(({ data: syncData, error: syncError }) => {
          if (syncError) {
            console.error("Auto-sync failed:", syncError);
          } else if (syncData?.count > 0) {
            toast.success(`Auto-synced ${syncData.count} events from ${syncData.source}`);
          }
        });
      }

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

  const handleCreateProject = async () => {
    if (!session?.user?.id || !newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const { error } = await supabase
        .from("projects")
        .insert({ name: newProjectName.trim(), user_id: session.user.id });
      if (error) throw error;
      await refetchProjects();
      setNewProjectName("");
      setConnected("project");
      setTimeout(() => {
        setConnected(null);
        setOpenDialog(null);
      }, 1500);
    } catch {
      toast.error("Failed to create project.");
    } finally {
      setCreatingProject(false);
    }
  };

  const analyticsConnected = !!(data.analytics?.posthog_personal_key || data.analytics?.mixpanel_secret || data.analytics?.ga_property_id || data.analytics?.metabase_url || data.analytics?.supabase_url || data.analytics?.posthog_key || data.analytics?.mixpanel_key);
  const codebaseConnected = !!data.codebase?.github_url;
  const businessDone = !!data.business?.product_description;

  // Always show the cards so users can edit/delete connections
  // if (!loading && analyticsConnected && codebaseConnected && businessDone && hasProject) return null;
  if (loading) return null;

  const steps = [
    { title: "Connect Analytics", description: "Link PostHog, Mixpanel, GA4, Metabase, or Supabase", logo: <div className="flex items-center gap-2"><img src={posthogLogo} alt="PostHog" className="h-5 w-5" /><img src={mixpanelLogo} alt="Mixpanel" className="h-5 w-5" /><img src={gaLogo} alt="Google Analytics" className="h-5 w-5" /><img src={metabaseLogo} alt="Metabase" className="h-5 w-5" /><img src={supabaseLogo} alt="Supabase" className="h-5 w-5 rounded" /></div>, done: analyticsConnected },
    { title: "Connect Codebase", description: "Link your GitHub repository for code-aware insights", logo: <img src={githubLogo} alt="GitHub" className="h-5 w-5" />, done: codebaseConnected },
    { title: "Business Context", description: "Chat with AI to describe your product", logo: <Sparkles className="h-4 w-4 text-muted-foreground" />, done: businessDone },
    { title: "Create Project", description: "Set up a project to get your API key for event tracking", logo: <Key className="h-4 w-4 text-muted-foreground" />, done: hasProject },
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

        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((step, i) => (
            <Card
              key={i}
              className={`transition-all cursor-pointer ${step.done ? "border-primary/40" : "hover:border-primary/30"}`}
              onClick={() => {
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
                    {step.done ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/20">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      step.logo
                    )}
                    <div>
                      <CardTitle className="text-sm">{step.title}</CardTitle>
                      <CardDescription className="text-xs">{step.description}</CardDescription>
                    </div>
                  </div>
                  {step.done ? (
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); if (i === 2) { navigate("/dashboard/chat"); } else { setOpenDialog(i); } }}>
                      Edit
                    </Button>
                  ) : (
                    i === 2
                      ? <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      : <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpenDialog(i); }}>
                          {i === 3 ? "Create" : "Connect"}
                        </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Analytics Dialog */}
      <Dialog open={openDialog === 0} onOpenChange={(open) => { if (!open) { setOpenDialog(null); setConnected(null); } }}>
        <DialogContent className="sm:max-w-2xl">
      {connected === "posthog" || connected === "mixpanel" || connected === "ga" || connected === "metabase" || connected === "supabase" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-lg">
                {connected === "posthog" ? "PostHog" : connected === "mixpanel" ? "Mixpanel" : connected === "metabase" ? "Metabase" : connected === "supabase" ? "Supabase" : "Google Analytics"} Connected!
              </p>
              <p className="text-sm text-muted-foreground">Your analytics data will be synced shortly.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                   <img src={posthogLogo} alt="PostHog" className="h-5 w-5" />
                   <img src={mixpanelLogo} alt="Mixpanel" className="h-5 w-5" />
                   <img src={gaLogo} alt="Google Analytics" className="h-5 w-5" />
                   <img src={metabaseLogo} alt="Metabase" className="h-5 w-5" />
                   <img src={supabaseLogo} alt="Supabase" className="h-5 w-5 rounded" />
                   Connect Analytics
                </DialogTitle>
                <DialogDescription>Connect one of the following analytics platforms.</DialogDescription>
              </DialogHeader>
              {analyticsConnected && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                  <div className="text-sm">
                    <span className="font-medium">
                      {data.analytics?.posthog_personal_key ? "PostHog" : data.analytics?.mixpanel_secret ? "Mixpanel" : data.analytics?.ga_property_id ? "Google Analytics" : data.analytics?.metabase_url ? "Metabase" : data.analytics?.supabase_url ? "Supabase" : data.analytics?.posthog_key ? "PostHog (legacy)" : "Mixpanel (legacy)"}
                    </span>
                    <span className="text-muted-foreground ml-1">connected</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const updated = { ...data, analytics: {} };
                      setPosthogKey("");
                      setPosthogPersonalKey("");
                      setPosthogProjectId("");
                      setPosthogHost("https://us.i.posthog.com");
                      setMixpanelKey("");
                      setMixpanelSecret("");
                      setMixpanelProjectId("");
                      setGaPropertyId("");
                      setGaServiceAccountJson("");
                      setMetabaseUrl("");
                      setMetabaseUsername("");
                      setMetabasePassword("");
                      setSupabaseUrl("");
                      setSupabaseAnonKey("");
                      setSupabaseTable("events");
                      saveData(updated);
                      toast.success("Analytics disconnected.");
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Disconnect
                  </Button>
                </div>
              )}
              <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
                {/* Tab toggle */}
                <div className="flex rounded-lg border border-border p-1 bg-muted/30">
                   {([
                    { key: "posthog" as const, label: "PostHog", logo: posthogLogo },
                    { key: "mixpanel" as const, label: "Mixpanel", logo: mixpanelLogo },
                    { key: "ga" as const, label: "GA4", logo: gaLogo },
                    { key: "metabase" as const, label: "Metabase", logo: metabaseLogo },
                    { key: "supabase" as const, label: "Supabase", logo: supabaseLogo },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setAnalyticsTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        analyticsTab === tab.key
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <img src={tab.logo} alt={tab.label} className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* PostHog form */}
                {analyticsTab === "posthog" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        Personal API Key <span className="text-destructive">*</span>
                        <a href="https://us.posthog.com/settings/user-api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Create key →</a>
                      </Label>
                      <Input placeholder="phx_..." value={posthogPersonalKey} onChange={(e) => setPosthogPersonalKey(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Required to read events. Found in Personal API Keys settings.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        Project ID <span className="text-destructive">*</span>
                        <a href="https://us.posthog.com/settings/project#variables" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Find ID →</a>
                      </Label>
                      <Input placeholder="12345" value={posthogProjectId} onChange={(e) => setPosthogProjectId(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Host (optional)</Label>
                      <Input placeholder="https://us.i.posthog.com" value={posthogHost} onChange={(e) => setPosthogHost(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Use https://eu.i.posthog.com for EU cloud.</p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!posthogPersonalKey || !posthogProjectId || saving}
                      onClick={() => saveData({
                        ...data,
                        analytics: {
                          ...data.analytics,
                          posthog_personal_key: posthogPersonalKey,
                          posthog_project_id: posthogProjectId,
                          posthog_host: posthogHost,
                        },
                      }, "posthog")}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Connect PostHog"}
                    </Button>
                  </div>
                )}

                {/* Mixpanel form */}
                {analyticsTab === "mixpanel" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        API Secret <span className="text-destructive">*</span>
                        <a href="https://mixpanel.com/settings/project#tokens" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Find secret →</a>
                      </Label>
                      <Input placeholder="API Secret..." value={mixpanelSecret} onChange={(e) => setMixpanelSecret(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Found in Project Settings → API Secret. Required to export events.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        Project ID <span className="text-destructive">*</span>
                      </Label>
                      <Input placeholder="1234567" value={mixpanelProjectId} onChange={(e) => setMixpanelProjectId(e.target.value)} />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!mixpanelSecret || !mixpanelProjectId || saving}
                      onClick={() => saveData({
                        ...data,
                        analytics: {
                          ...data.analytics,
                          mixpanel_secret: mixpanelSecret,
                          mixpanel_project_id: mixpanelProjectId,
                        },
                      }, "mixpanel")}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Connect Mixpanel"}
                    </Button>
                  </div>
                )}

                {/* Google Analytics form */}
                {analyticsTab === "ga" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        Property ID <span className="text-destructive">*</span>
                        <a href="https://analytics.google.com/analytics/web/#/a/p/admin/property" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Find ID →</a>
                      </Label>
                      <Input placeholder="123456789" value={gaPropertyId} onChange={(e) => setGaPropertyId(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Found in GA4 Admin → Property Settings → Property ID.</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center justify-between">
                        Service Account JSON <span className="text-destructive">*</span>
                        <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Create key →</a>
                      </Label>
                      <textarea
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] font-mono text-xs"
                        placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                        value={gaServiceAccountJson}
                        onChange={(e) => setGaServiceAccountJson(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Create a service account, grant it "Viewer" on your GA4 property, and paste the JSON key here.</p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!gaPropertyId || !gaServiceAccountJson || saving}
                      onClick={() => saveData({
                        ...data,
                        analytics: {
                          ...data.analytics,
                          ga_property_id: gaPropertyId,
                          ga_service_account_json: gaServiceAccountJson,
                        },
                      }, "ga")}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Connect Google Analytics"}
                    </Button>
                  </div>
                )}

                {/* Metabase form */}
                {analyticsTab === "metabase" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>
                        Metabase URL <span className="text-destructive">*</span>
                      </Label>
                      <Input placeholder="https://your-metabase.example.com" value={metabaseUrl} onChange={(e) => setMetabaseUrl(e.target.value)} />
                      <p className="text-xs text-muted-foreground">The URL of your Metabase instance.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Username / Email <span className="text-destructive">*</span></Label>
                      <Input placeholder="admin@example.com" value={metabaseUsername} onChange={(e) => setMetabaseUsername(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Password <span className="text-destructive">*</span></Label>
                      <Input type="password" placeholder="••••••••" value={metabasePassword} onChange={(e) => setMetabasePassword(e.target.value)} />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!metabaseUrl || !metabaseUsername || !metabasePassword || saving}
                      onClick={() => saveData({
                        ...data,
                        analytics: {
                          ...data.analytics,
                          metabase_url: metabaseUrl,
                          metabase_username: metabaseUsername,
                          metabase_password: metabasePassword,
                        },
                      }, "metabase")}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Connect Metabase"}
                    </Button>
                  </div>
                )}

                {/* Supabase form */}
                {analyticsTab === "supabase" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>
                        Supabase Project URL <span className="text-destructive">*</span>
                      </Label>
                      <Input placeholder="https://xyzproject.supabase.co" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Found in your Supabase project settings → API.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Anon / Public Key <span className="text-destructive">*</span>
                      </Label>
                      <Input placeholder="eyJhbGciOi..." value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)} />
                      <p className="text-xs text-muted-foreground">The anon/public key from your Supabase project API settings.</p>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!supabaseUrl || !supabaseAnonKey || saving}
                      onClick={() => saveData({
                        ...data,
                        analytics: {
                          ...data.analytics,
                          supabase_url: supabaseUrl,
                          supabase_anon_key: supabaseAnonKey,
                          supabase_table: supabaseTable || "events",
                        },
                      }, "supabase")}
                    >
                      {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Connect Supabase"}
                    </Button>
                  </div>
                )}
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
                <DialogTitle className="flex items-center gap-2">
                  <img src={githubLogo} alt="GitHub" className="h-5 w-5" />
                  Connect Codebase
                </DialogTitle>
                <DialogDescription>Link your GitHub repository for code-aware insights.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {codebaseConnected && (
                  <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                    <div className="text-sm">
                      <span className="font-medium truncate max-w-[200px] inline-block align-middle">{data.codebase?.github_url}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => {
                        const updated = { ...data, codebase: {} };
                        setGithubUrl("");
                        setGithubPat("");
                        saveData(updated);
                        toast.success("Repository disconnected.");
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Disconnect
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>GitHub Repository URL <span className="text-destructive">*</span></Label>
                  <Input placeholder="https://github.com/org/repo" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    Personal Access Token
                    <a href="https://github.com/settings/tokens/new?scopes=repo&description=ECP+Access" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-normal">Create token →</a>
                  </Label>
                  <Input type="password" placeholder="ghp_..." value={githubPat} onChange={(e) => setGithubPat(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Optional for public repos, required for private repos. Enables code-aware AI insights.</p>
                </div>
                <Button
                  className="w-full"
                  disabled={!githubUrl || saving}
                  onClick={() => saveData({ ...data, codebase: { github_url: githubUrl, github_pat: githubPat || undefined } }, "github")}
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</> : codebaseConnected ? "Update Repository" : "Connect Repository"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={openDialog === 3} onOpenChange={(open) => { if (!open) { setOpenDialog(null); setConnected(null); } }}>
        <DialogContent className="sm:max-w-md">
          {connected === "project" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold text-lg">Project Created!</p>
              <p className="text-sm text-muted-foreground">Your API key is ready to use.</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>Name your project to isolate it from other projects connected to the same analytics account — makes it easier to tell them apart.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input placeholder="My App" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!newProjectName.trim() || creatingProject}
                  onClick={handleCreateProject}
                >
                  {creatingProject ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</> : <>
                    <FolderPlus className="h-4 w-4 mr-2" /> Create Project
                  </>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
