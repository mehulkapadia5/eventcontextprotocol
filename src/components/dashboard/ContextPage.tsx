import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContextMemoryView } from "@/components/dashboard/ContextMemoryView";

export function ContextPage() {
  const { session } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-context"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const od = profile?.onboarding_data as any;
  const hasContext = od?.business?.product_description || od?.business?.audience || od?.business?.goals || od?.business?.stage || od?.business?.challenges || od?.codebase?.github_url || od?.analytics;

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Context Memory</h1>
      <p className="text-muted-foreground text-sm">
        This is what the AI has learned about your business — saved from your chat conversations.
      </p>
      {hasContext ? (
        <ContextMemoryView data={od.business || {}} analytics={od.analytics} codebase={od.codebase} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No context saved yet. Go to <span className="font-medium text-foreground">Chat</span> to teach the AI about your business.
        </div>
      )}
    </div>
  );
}
