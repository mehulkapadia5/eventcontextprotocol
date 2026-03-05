import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, LogIn, Loader2, ExternalLink, Coins, Plus } from "lucide-react";
import { toast } from "sonner";

export function AdminUsers() {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [creditsDialog, setCreditsDialog] = useState<{ userId: string; displayName: string } | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState("10");
  const [addingCredits, setAddingCredits] = useState(false);
  const queryClient = useQueryClient();

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

  const { data: allCredits } = useQuery({
    queryKey: ["admin-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_credits").select("*");
      if (error) throw error;
      return data;
    },
  });

  const creditsMap = new Map<string, number>();
  allCredits?.forEach((c: any) => {
    creditsMap.set(c.user_id, c.credits_remaining);
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

  const handleAddCredits = async () => {
    if (!creditsDialog) return;
    const amount = parseInt(creditsToAdd, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid positive number");
      return;
    }
    setAddingCredits(true);
    try {
      const currentCredits = creditsMap.get(creditsDialog.userId) ?? 0;

      // Upsert credits
      const { error } = await supabase
        .from("user_credits")
        .upsert(
          { user_id: creditsDialog.userId, credits_remaining: currentCredits + amount, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;

      // Log transaction
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("credit_transactions").insert({
        user_id: creditsDialog.userId,
        amount,
        reason: "admin_grant",
        admin_id: session?.user?.id,
      });

      toast.success(`Added ${amount} credits to ${creditsDialog.displayName}`);
      queryClient.invalidateQueries({ queryKey: ["admin-credits"] });
      setCreditsDialog(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to add credits");
    } finally {
      setAddingCredits(false);
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
                <TableHead>Credits</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              )}
              {users?.map((u) => {
                const userCredits = creditsMap.get(u.user_id);
                return (
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
                      <div className="flex items-center gap-2">
                        <Badge variant={userCredits === 0 ? "destructive" : "outline"} className="gap-1">
                          <Coins className="h-3 w-3" />
                          {userCredits ?? "—"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setCreditsDialog({ userId: u.user_id, displayName: u.display_name || "User" })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
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
                );
              })}
              {!isLoading && !users?.length && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No users found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={(open) => !open && setCreditsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits — {creditsDialog?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Current balance: <strong>{creditsMap.get(creditsDialog?.userId ?? "") ?? 0}</strong> credits
            </p>
            <Input
              type="number"
              min="1"
              value={creditsToAdd}
              onChange={(e) => setCreditsToAdd(e.target.value)}
              placeholder="Number of credits to add"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsDialog(null)}>Cancel</Button>
            <Button onClick={handleAddCredits} disabled={addingCredits}>
              {addingCredits ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Coins className="h-4 w-4 mr-2" />}
              Add Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
