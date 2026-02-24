import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderKanban, Zap, Brain } from "lucide-react";

export function AdminOverview() {
  const { data: users } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["admin-events-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("events").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const contextsCount = users?.filter((u) => {
    const od = u.onboarding_data as any;
    return od?.business?.product_description;
  }).length ?? 0;

  const stats = [
    { label: "Total Users", value: users?.length ?? 0, icon: Users },
    { label: "Total Projects", value: projects?.length ?? 0, icon: FolderKanban },
    { label: "Total Events", value: events ?? 0, icon: Zap },
    { label: "Business Contexts", value: contextsCount, icon: Brain },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Overview</h1>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
