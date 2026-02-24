import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepBusinessContext } from "@/components/onboarding/StepBusinessContext";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

export function ChatPage() {
  const { session } = useAuth();
  const [data, setData] = useState<OnboardingData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_data")
      .eq("user_id", session.user.id)
      .single();
    const od = (profile as any)?.onboarding_data as OnboardingData | null;
    if (od) setData(od);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFinish = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const allDone = !!(data.analytics?.posthog_key || data.analytics?.mixpanel_key) &&
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
      const updated = { ...data, business: {} };
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_data: updated,
          onboarding_completed: false,
        } as any)
        .eq("user_id", session.user.id);
      if (error) throw error;
      setData(updated);
      setResetKey((k) => k + 1);
      toast.success("Context cleared. Start a new conversation.");
    } catch {
      toast.error("Failed to clear context.");
    }
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
      />
    </div>
  );
}
