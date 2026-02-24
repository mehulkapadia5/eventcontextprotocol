import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Code2, Briefcase, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { StepBusinessContext } from "./StepBusinessContext";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

export function OnboardingCards() {
  const { session } = useAuth();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Local input state
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

  const saveData = async (updated: OnboardingData) => {
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
      toast.success("Saved!");
      setExpandedStep(null);
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const analyticsConnected = !!(data.analytics?.posthog_key || data.analytics?.mixpanel_key);
  const codebaseConnected = !!data.codebase?.github_url;
  const businessDone = !!data.business?.product_description;

  // Hide if all 3 are done
  if (!loading && analyticsConnected && codebaseConnected && businessDone) return null;
  if (loading) return null;

  const steps = [
    {
      title: "Connect Analytics",
      description: "Link PostHog or Mixpanel to import event data",
      icon: BarChart3,
      done: analyticsConnected,
    },
    {
      title: "Connect Codebase",
      description: "Link your GitHub repository for code-aware insights",
      icon: Code2,
      done: codebaseConnected,
    },
    {
      title: "Business Context",
      description: "Tell us about your product for tailored insights",
      icon: Briefcase,
      done: businessDone,
    },
  ];

  return (
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
            className={`transition-all ${step.done ? "border-primary/40 opacity-75" : "cursor-pointer hover:border-primary/30"} ${expandedStep === i ? "md:col-span-3" : ""}`}
          >
            <CardHeader
              className="pb-2 cursor-pointer"
              onClick={() => !step.done && setExpandedStep(expandedStep === i ? null : i)}
            >
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
                  expandedStep === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>

            {expandedStep === i && !step.done && (
              <CardContent className="pt-0">
                {/* Step 0: Analytics */}
                {i === 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">PostHog API Key</label>
                      <Input placeholder="phc_..." value={posthogKey} onChange={(e) => setPosthogKey(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Mixpanel Project Token</label>
                      <Input placeholder="Token..." value={mixpanelKey} onChange={(e) => setMixpanelKey(e.target.value)} />
                    </div>
                    <Button
                      size="sm"
                      disabled={(!posthogKey && !mixpanelKey) || saving}
                      onClick={() => saveData({ ...data, analytics: { posthog_key: posthogKey || undefined, mixpanel_key: mixpanelKey || undefined } })}
                    >
                      {saving ? "Saving..." : "Connect"}
                    </Button>
                  </div>
                )}

                {/* Step 1: Codebase */}
                {i === 1 && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">GitHub Repository URL</label>
                      <Input placeholder="https://github.com/org/repo" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
                    </div>
                    <Button
                      size="sm"
                      disabled={!githubUrl || saving}
                      onClick={() => saveData({ ...data, codebase: { github_url: githubUrl } })}
                    >
                      {saving ? "Saving..." : "Connect"}
                    </Button>
                  </div>
                )}

                {/* Step 2: Business Context (AI Chat) */}
                {i === 2 && (
                  <div className="pt-2">
                    <StepBusinessContext
                      data={data.business || {}}
                      onUpdate={(biz) => {
                        const updated = { ...data, business: biz };
                        setData(updated);
                      }}
                      onFinish={() => saveData({ ...data, business: data.business })}
                      isSubmitting={saving}
                    />
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
