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

  if (loading) return <div className="flex-1" />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <StepBusinessContext
        data={data.business || {}}
        onUpdate={(biz) => setData((prev) => ({ ...prev, business: biz }))}
        onFinish={handleFinish}
        isSubmitting={saving}
        fullPage
      />
    </div>
  );
}
