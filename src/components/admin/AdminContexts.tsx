import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContextMemoryView } from "@/components/dashboard/ContextMemoryView";

export function AdminContexts() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-contexts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const usersWithContext = users?.filter((u) => {
    const od = u.onboarding_data as any;
    return od?.business?.product_description;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Business Contexts</h1>
        <Badge variant="secondary">{usersWithContext?.length ?? 0} contexts saved</Badge>
      </div>
      {isLoading && <div className="text-muted-foreground">Loading...</div>}
      {usersWithContext?.map((u) => {
        const od = u.onboarding_data as any;
        return (
          <Card key={u.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{u.display_name || "Unknown User"}</CardTitle>
                <Badge variant={u.onboarding_completed ? "default" : "secondary"}>
                  {u.onboarding_completed ? "Complete" : "In Progress"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Updated: {new Date(u.updated_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <ContextMemoryView data={od?.business || {}} analytics={od?.analytics} codebase={od?.codebase} />
            </CardContent>
          </Card>
        );
      })}
      {!isLoading && !usersWithContext?.length && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No business contexts saved yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
