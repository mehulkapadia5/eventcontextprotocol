import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useCredits() {
  const { session } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("user_credits")
      .select("credits_remaining")
      .eq("user_id", session.user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No row yet — create one with defaults
      const { data: inserted } = await supabase
        .from("user_credits")
        .insert({ user_id: session.user.id, credits_remaining: 5 })
        .select("credits_remaining")
        .single();
      setCredits(inserted?.credits_remaining ?? 5);
    } else if (data) {
      setCredits(data.credits_remaining);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const consumeCredit = useCallback(async (): Promise<boolean> => {
    if (!session?.user?.id || credits === null) return false;
    if (credits <= 0) return false;

    const newCredits = credits - 1;
    const { error } = await supabase
      .from("user_credits")
      .update({ credits_remaining: newCredits, updated_at: new Date().toISOString() })
      .eq("user_id", session.user.id);

    if (error) return false;

    // Log transaction
    await supabase.from("credit_transactions").insert({
      user_id: session.user.id,
      amount: -1,
      reason: "message",
    });

    setCredits(newCredits);
    return true;
  }, [session?.user?.id, credits]);

  const isLow = credits !== null && credits <= 1 && credits > 0;
  const isExhausted = credits !== null && credits <= 0;

  return { credits, loading, isLow, isExhausted, consumeCredit, refetch: fetchCredits };
}
