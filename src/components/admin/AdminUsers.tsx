import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, LogIn, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function AdminUsers() {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const roleMap = new Map<string, string[]>();
  roles?.forEach((r) => {
    const existing = roleMap.get(r.user_id) ?? [];
    existing.push(r.role);
    roleMap.set(r.user_id, existing);
  });

  const handleLoginAs = async (email: string) => {
    setGeneratingFor(email);
    try {
      const { data, error } = await supabase.functions.invoke("admin-impersonate", {
        body: { user_email: email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success(`Login link opened for ${email}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate login link");
    } finally {
      setGeneratingFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display Name</TableHead>
                <TableHead>Onboarding</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {users?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                  <TableCell>
                    {u.onboarding_completed ? (
                      <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Done</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {roleMap.get(u.user_id)?.map((r) => (
                      <Badge key={r} variant="outline" className="mr-1">{r}</Badge>
                    )) || <span className="text-muted-foreground text-xs">user</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={generatingFor === u.display_name}
                      onClick={() => handleLoginAs(u.display_name || "")}
                    >
                      {generatingFor === u.display_name ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LogIn className="h-3 w-3" />
                      )}
                      Login as
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !users?.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
