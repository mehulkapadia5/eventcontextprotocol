import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepBusinessContext } from "@/components/onboarding/StepBusinessContext";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string; github_pat?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

export function ChatPage() {
  const { session } = useAuth();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [repoContext, setRepoContext] = useState<string | null>(null);
  const [savedConfidence, setSavedConfidence] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", session.user.id)
      .single();
    const od = (profile as any)?.onboarding_data as OnboardingData | null;
    if (od) {
      setData(od);
      setSavedConfidence((od as any).ai_confidence ?? 0);
      // Use persisted context if available, otherwise fetch live
      if ((od.codebase as any)?.context) {
        setRepoContext((od.codebase as any).context);
      } else if (od.codebase?.github_url) {
        fetchGitHubContext(od.codebase.github_url, od.codebase.github_pat);
      }
    }
    setLoading(false);
  }, [session?.user?.id]);

  const fetchGitHubContext = async (githubUrl: string, githubPat?: string) => {
    try {
      const { data: ctx, error } = await supabase.functions.invoke("fetch-github-context", {
        body: { github_url: githubUrl, github_pat: githubPat },
      });
      if (error) throw error;
      if (ctx && !ctx.error) {
        const summary = [
          `Repository: ${ctx.repo}`,
          ctx.description ? `Description: ${ctx.description}` : "",
          ctx.language ? `Primary language: ${ctx.language}` : "",
          ctx.topics?.length ? `Topics: ${ctx.topics.join(", ")}` : "",
          `File tree (${ctx.file_tree?.length || 0} files): ${(ctx.file_tree || []).slice(0, 50).join(", ")}`,
          ...Object.entries(ctx.key_files || {}).map(
            ([path, content]) => `\n--- ${path} ---\n${(content as string).slice(0, 2000)}`
          ),
        ]
          .filter(Boolean)
          .join("\n");
        setRepoContext(summary);
        
        // Trigger event discovery in background
        const { data: project } = await supabase.from("projects").select("id").eq("user_id", session?.user?.id).single();
        if (project?.id) {
          supabase.functions.invoke("discover-events", {
            body: { repo_context: summary, project_id: project.id }
          }).then(({ error }) => {
            if (!error) toast.success("Event discovery started based on your codebase.");
          });
        }

        // Persist context so it's available instantly next time
        if (session?.user?.id) {
          supabase.from("profiles").update({
            onboarding_data: {
              ...data,
              codebase: { ...data.codebase, context: summary },
            },
          } as any).eq("user_id", session.user.id).then(() => {});
        }
      }
    } catch (e) {
      console.warn("Failed to fetch GitHub context:", e);
    }
  };

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFinish = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const analytics = data.analytics as any;
      const hasAnalytics = !!(analytics?.posthog_key || analytics?.posthog_personal_key || analytics?.mixpanel_key || analytics?.mixpanel_secret || analytics?.ga4_property_id);
      const allDone = hasAnalytics &&
        !!data.codebase?.github_url &&
        !!data.business?.product_description;

      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: data,
          onboarding_completed: allDone,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      toast.success("Business context saved!");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearContext = async () => {
    if (!session?.user?.id) return;
    try {
      const updated = { ...data, business: {}, ai_confidence: 0 };
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: updated,
          onboarding_completed: false,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setData(updated);
      setSavedConfidence(0);
      setResetKey((k) => k + 1);
      toast.success("Context cleared. Start a new conversation.");
    } catch {
      toast.error("Failed to clear context.");
    }
  };

  const handleConfidenceChange = async (confidence: number) => {
    setSavedConfidence(confidence);
    if (!session?.user?.id) return;
    // Persist confidence in background
    supabase.from("profiles").update({
      onboarding_data: { ...data, ai_confidence: confidence },
    } as any).eq("user_id", session.user.id).then(() => {});
  };

  if (loading) return <div className="flex-1" />;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] -m-6 md:-m-8">
      <StepBusinessContext
        key={resetKey}
        data={data.business || {}}
        onUpdate={(biz) => setData((prev) => ({ ...prev, business: biz }))}
        onFinish={handleFinish}
        onClearContext={handleClearContext}
        isSubmitting={saving}
        fullPage
        repoContext={repoContext}
        savedConfidence={savedConfidence}
        onConfidenceChange={handleConfidenceChange}
      />
    </div>
  );
}
