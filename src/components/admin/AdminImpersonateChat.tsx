import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, MessageSquare, Save, RefreshCw, Pencil } from "lucide-react";
import { StepBusinessContext } from "@/components/onboarding/StepBusinessContext";
import { ContextMemoryView } from "@/components/dashboard/ContextMemoryView";

interface OnboardingData {
  analytics?: { posthog_key?: string; mixpanel_key?: string };
  codebase?: { github_url?: string; github_pat?: string; context?: string };
  business?: { product_description?: string; audience?: string; goals?: string; [key: string]: string | undefined };
}

export function AdminImpersonateChat() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<OnboardingData>({});
  const [repoContext, setRepoContext] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [mode, setMode] = useState<"chat" | "edit">("chat");
  const [editBiz, setEditBiz] = useState({ product_description: "", audience: "", goals: "" });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-for-impersonate"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const selectedUser = users?.find((u) => u.user_id === selectedUserId);

  const loadUserData = useCallback(() => {
    if (!selectedUser) return;
    const od = (selectedUser.onboarding_data as any) as OnboardingData | null;
    const d = od || {};
    setUserData(d);
    setRepoContext(d.codebase?.context || null);
    setEditBiz({
      product_description: d.business?.product_description || "",
      audience: d.business?.audience || "",
      goals: d.business?.goals || "",
    });
    setChatKey((k) => k + 1);
  }, [selectedUser]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const handleSaveContext = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const updated: OnboardingData = {
        ...userData,
        business: { ...userData.business, ...editBiz },
      };
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_data: updated } as any)
        .eq("user_id", selectedUserId);
      if (error) throw error;
      setUserData(updated);
      toast.success("Context saved for user!");
      setMode("chat");
      setChatKey((k) => k + 1);
    } catch {
      toast.error("Failed to save context.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_data: userData, onboarding_completed: true } as any)
        .eq("user_id", selectedUserId);
      if (error) throw error;
      toast.success("Context saved!");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearContext = async () => {
    if (!selectedUserId) return;
    try {
      const updated = { ...userData, business: {} };
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_data: updated, onboarding_completed: false } as any)
        .eq("user_id", selectedUserId);
      if (error) throw error;
      setUserData(updated);
      setChatKey((k) => k + 1);
      toast.success("Context cleared for user.");
    } catch {
      toast.error("Failed to clear context.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5" /> Impersonate Chat
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Select a user to view/edit their context and test the AI chat as them.
      </p>

      {/* User selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedUserId || ""} onValueChange={(v) => setSelectedUserId(v)}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a user..." />
          </SelectTrigger>
          <SelectContent>
            {users?.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.display_name || u.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedUser && (
          <>
            <Badge variant={selectedUser.onboarding_completed ? "default" : "secondary"}>
              {selectedUser.onboarding_completed ? "Context Complete" : "Incomplete"}
            </Badge>
            <div className="flex gap-1">
              <Button
                variant={mode === "chat" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("chat")}
                className="gap-1"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat
              </Button>
              <Button
                variant={mode === "edit" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("edit")}
                className="gap-1"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Context
              </Button>
            </div>
          </>
        )}
      </div>

      {isLoading && <div className="text-muted-foreground">Loading users...</div>}

      {selectedUserId && selectedUser && mode === "edit" && (
        <div className="space-y-4">
          {/* Current context view */}
          {userData.business?.product_description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Saved Context</CardTitle>
              </CardHeader>
              <CardContent>
                <ContextMemoryView data={userData.business || {}} analytics={userData.analytics} codebase={userData.codebase} />
              </CardContent>
            </Card>
          )}

          {/* Edit form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Edit Business Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Product Description</label>
                <Textarea
                  value={editBiz.product_description}
                  onChange={(e) => setEditBiz((p) => ({ ...p, product_description: e.target.value }))}
                  rows={3}
                  placeholder="What does this user's product do?"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Target Audience</label>
                <Input
                  value={editBiz.audience}
                  onChange={(e) => setEditBiz((p) => ({ ...p, audience: e.target.value }))}
                  placeholder="Who are the users?"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Goals</label>
                <Textarea
                  value={editBiz.goals}
                  onChange={(e) => setEditBiz((p) => ({ ...p, goals: e.target.value }))}
                  rows={2}
                  placeholder="What are the business goals?"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveContext} disabled={saving} className="gap-1">
                  <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save & Switch to Chat"}
                </Button>
                <Button variant="outline" onClick={handleClearContext}>
                  Clear Context
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedUserId && selectedUser && mode === "chat" && (
        <div className="flex flex-col h-[calc(100vh-16rem)] border border-border rounded-lg overflow-hidden">
          <StepBusinessContext
            key={chatKey}
            data={userData.business || {}}
            onUpdate={(biz) => setUserData((prev) => ({ ...prev, business: biz }))}
            onFinish={handleFinish}
            onClearContext={handleClearContext}
            isSubmitting={saving}
            fullPage
            repoContext={repoContext}
          />
        </div>
      )}

      {!selectedUserId && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a user above to impersonate their chat experience and test AI responses.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
